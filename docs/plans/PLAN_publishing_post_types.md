# PLAN: Publishing — Stories, Reel Types & Per-Platform Bulk Media

**Status:** Ready for implementation  
**Estimated effort:** 1 day  
**Files touched:** 4

---

## What We're Building

Five additions to the publishing flow:

1. **Story posting** for Instagram and Facebook (ComposeDialog)
2. **Reel vs Trial Reel** choice for Instagram; Reel for Facebook (ComposeDialog)
3. **Per-platform media in Bulk Scheduling** — different image/video per platform per row
4. **Post type columns in Bulk Scheduling** — IG type and FB type per row
5. **Excel template update** — new columns for all of the above

---

## How Posting Currently Works (Full Flow)

### ComposeDialog → API → Metricool

**Step 1 — User fills ComposeDialog**

User picks: client, platforms, caption (EN/AR), media (single URL, upload, or Drive link, or carousel), schedule date.

If multiple platforms + different media per platform: user toggles "Different creative per platform" → per-platform URL overrides appear. The frontend groups platforms by their effective URL and fires **one separate API call per unique-URL group**.

**Step 2 — POST /api/metricool/schedule**

Body sent:
```json
{
  "client_id": "uuid",
  "platforms": ["instagram", "facebook"],
  "caption": "English caption\n\nArabic caption",
  "media_url": "https://cdn.example.com/image.jpg",
  "media_urls": null,
  "is_video": false,
  "scheduled_at": "2026-06-10T09:00:00Z"
}
```

For carousel: `media_urls` is an array of slide URLs; `media_url` is omitted.

**Step 3 — API route (app/api/metricool/schedule/route.ts)**

1. Merges EN + AR captions (newline-separated).
2. Resolves any Google Drive links to absolute URLs via the `/api/proxy/drive` route.
3. Inserts a row into `scheduled_posts` with `status = 'draft'`.
4. Looks up `client.metricool_blog_id` — if missing, returns `saved_as_draft: true` and stops.
5. Maps platforms to Metricool network names via `PLATFORM_TO_METRICOOL`.
6. Calls `lib/metricool.schedulePost()`.

**Step 4 — lib/metricool.schedulePost()**

1. **Normalizes** each media URL by POSTing to Metricool's CDN normalizer:
   ```
   GET https://app.metricool.com/api/actions/normalize/image/url?url=<encoded>
   ```
   Returns a Metricool CDN URL string. This is what Metricool stores as `mediaId`.

2. **Detects video** — checks if the original URL or the normalized CDN URL contains `/video/` or a video extension.

3. **Builds the Metricool payload:**
   ```json
   {
     "autoPublish": true,
     "text": "caption",
     "providers": [{ "network": "instagram" }, { "network": "facebook" }],
     "publicationDate": { "dateTime": "2026-06-10T09:00:00", "timezone": "UTC" },
     "media": ["https://static.metricool.com/...CDN-URL..."],
     "instagramData": { "type": "POST" },
     "facebookData": { "type": "POST" },
     "tiktokData": { "privacyOption": "PUBLIC_TO_EVERYONE" }
   }
   ```
   - `type` is set to `"REEL"` (+ `showReelOnFeed: true` for Instagram) if video detected.
   - `media` is a flat array of CDN URL strings — one item for single, multiple for carousel.

4. **POST** to `https://app.metricool.com/api/v2/scheduler/posts?userId=&blogId=`

**Step 5 — On success**

Updates `scheduled_posts.status = 'scheduled'` and stores `metricool_post_id`.

---

## How Posting Works With New Additions

### Stories

**User action:** In ComposeDialog, after selecting Instagram or Facebook, a "Post Type" row appears. User picks **Story**.

**What changes in the API payload:**
```json
{
  "instagramData": { "type": "STORY" },
  "facebookData": { "type": "STORY" }
}
```

- No `showReelOnFeed` — that's Reel-only.
- Story type forces **single media** — carousel is disabled in the UI.
- Ideal aspect ratio: **9:16** (vertical). The aspect checker already validates this.
- Instagram story video: max 60 s (15 s per slide); image: displayed 7 s.
- Facebook story video: max 20 s.

The post type is independent per platform. User can post an Instagram Story and a Facebook Reel in the same ComposeDialog submission. Because Metricool takes a single unified `instagramData` + `facebookData` block per call, mixed types (Story + non-Story) within the same call work fine.

### Reel vs Trial Reel

**Reel** (existing, now explicit):
```json
{ "instagramData": { "type": "REEL", "showReelOnFeed": true } }
```
Goes live to followers + Reels tab immediately.

**Trial Reel** (new — Instagram only):
```json
{ "instagramData": { "type": "TRIAL_REEL", "showReelOnFeed": true } }
```
Instagram shows the reel to non-followers for 24 h. If it performs (based on Instagram's threshold), it goes live to the main feed. If not, only the creator sees it. The user selects this from the same IG post type picker.

**Facebook Reel** stays as:
```json
{ "facebookData": { "type": "REEL" } }
```

Trial Reel is **Instagram only** — the FB post type picker never shows this option.

### Per-Platform Media in Bulk Scheduling

Each bulk row now has per-platform URL overrides alongside the default media URL. The `scheduleAll()` function checks: if any platform has a different URL from the default, it splits that row into separate API calls — one per unique-URL group — exactly like ComposeDialog's existing `customPerPlatform` flow.

Example:
- Row has: default media = `img-A.jpg`, Instagram override = `img-B.jpg`
- Result: one API call for `[facebook, tiktok, linkedin]` with `img-A.jpg` and one call for `[instagram]` with `img-B.jpg`.

### Excel Template

New columns added after existing 7:
- **Col H:** IG Post Type — dropdown: `POST / REEL / TRIAL_REEL / STORY`
- **Col I:** FB Post Type — dropdown: `POST / REEL / STORY`
- **Col J–N:** Instagram / Facebook / TikTok / LinkedIn / Twitter Media — per-platform URL overrides

When importing, the parser reads H + I → post types, J–N → platform_media overrides.

---

## Implementation — File-by-File Changes

### 1. `lib/types.ts`

Add two new union types after `SocialPlatform`:

```ts
export type InstagramPostType = 'POST' | 'REEL' | 'TRIAL_REEL' | 'STORY'
export type FacebookPostType  = 'POST' | 'REEL' | 'STORY'
```

---

### 2. `lib/metricool.ts`

**A. Update `MetricoolScheduleInput` interface:**

```ts
export interface MetricoolScheduleInput {
  blogId: string | number
  text: string
  providers: MetricoolProvider[]
  publicationDate: DateTimeInfo
  imageUrls?: string[]
  autoPublish?: boolean
  tiktokPrivacy?: TikTokPrivacyLevel
  instagramData?: Record<string, unknown>
  facebookData?: Record<string, unknown>
  isVideo?: boolean
  // NEW
  instagramPostType?: 'POST' | 'REEL' | 'TRIAL_REEL' | 'STORY'
  facebookPostType?: 'POST' | 'REEL' | 'STORY'
}
```

**B. Update `schedulePost()` — instagramData block:**

Replace the existing Instagram block:
```ts
if (networks.includes('instagram')) {
  const igType = instagramPostType ?? (hasVideo ? 'REEL' : 'POST')
  const isReel = igType === 'REEL' || igType === 'TRIAL_REEL'
  payload.instagramData = {
    type: igType,
    ...(isReel ? { showReelOnFeed: true } : {}),
    ...(instagramDataIn ?? {}),
  }
}
```

Replace the existing Facebook block:
```ts
if (networks.includes('facebook')) {
  const fbType = facebookPostType ?? (hasVideo ? 'REEL' : 'POST')
  payload.facebookData = { type: fbType, ...(facebookDataIn ?? {}) }
}
```

Also destructure the new params at the top of `schedulePost()`:
```ts
const { blogId, imageUrls, tiktokPrivacy, instagramData: instagramDataIn, facebookData: facebookDataIn,
        isVideo: isVideoOverride, instagramPostType, facebookPostType, ...rest } = input
```

---

### 3. `app/api/metricool/schedule/route.ts`

**POST handler — accept new body fields:**

```ts
const { client_id, platforms, caption, caption_ar, media_url, media_urls,
        scheduled_at, task_id, is_video,
        // NEW
        instagram_post_type, facebook_post_type } = body
```

**Pass to schedulePost():**

```ts
const metricoolPost = await schedulePost({
  blogId: client.metricool_blog_id,
  text: finalCaption,
  providers,
  publicationDate,
  ...splitMediaUrls(resolvedMediaUrls),
  ...(is_video != null ? { isVideo: Boolean(is_video) } : {}),
  // NEW
  ...(instagram_post_type ? { instagramPostType: instagram_post_type } : {}),
  ...(facebook_post_type  ? { facebookPostType:  facebook_post_type  } : {}),
})
```

> **Note for future DB wiring:** Add a `platform_settings_json` column to `scheduled_posts` to persist these so the PATCH (reschedule) handler can re-read and re-apply them.

---

### 4. `app/(app)/publishing/page.tsx`

This file gets the bulk of the UI work. Split into four sub-tasks:

---

#### 4a. ComposeDialog — post type state

Add after `const [thumbnailUrl, setThumbnailUrl] = useState('')`:
```ts
const [instagramPostType, setInstagramPostType] = useState<'POST' | 'REEL' | 'TRIAL_REEL' | 'STORY'>('POST')
const [facebookPostType,  setFacebookPostType]  = useState<'POST' | 'REEL' | 'STORY'>('POST')
```

---

#### 4b. ComposeDialog — post type UI section

Insert a new section between **Platforms** and **Media** pickers. Only renders if Instagram or Facebook is selected:

```tsx
{(selectedPlatforms.includes('instagram') || selectedPlatforms.includes('facebook')) && (
  <div className="space-y-2">
    <label className="block text-xs font-semibold text-slate-700">Post Type</label>

    {selectedPlatforms.includes('instagram') && (
      <div>
        <p className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
          <PlatformIcon platform="instagram" size="xs"/> Instagram
        </p>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {([
            { id: 'POST',       label: 'Post'        },
            { id: 'REEL',       label: 'Reel'        },
            { id: 'TRIAL_REEL', label: 'Trial Reel'  },
            { id: 'STORY',      label: 'Story'       },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setInstagramPostType(id)}
              className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                instagramPostType === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {label}
            </button>
          ))}
        </div>
      </div>
    )}

    {selectedPlatforms.includes('facebook') && (
      <div>
        <p className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
          <PlatformIcon platform="facebook" size="xs"/> Facebook
        </p>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {([
            { id: 'POST',  label: 'Post'  },
            { id: 'REEL',  label: 'Reel'  },
            { id: 'STORY', label: 'Story' },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setFacebookPostType(id)}
              className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                facebookPostType === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {label}
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Story aspect ratio hint */}
    {(instagramPostType === 'STORY' || facebookPostType === 'STORY') && (
      <p className="text-[10px] text-amber-600 flex items-center gap-1">
        <TriangleAlert className="w-3 h-3 shrink-0"/>
        Stories require 9:16 vertical media. Carousel is disabled for story posts.
      </p>
    )}

    {/* Trial Reel hint */}
    {instagramPostType === 'TRIAL_REEL' && (
      <p className="text-[10px] text-slate-400">
        Trial Reel shows to non-followers first for 24 h before going live based on performance.
      </p>
    )}
  </div>
)}
```

**Carousel disable when Story selected:**

In the Media mode tab bar, add `disabled` to the carousel button when a story type is active:
```ts
const storySelected = instagramPostType === 'STORY' || facebookPostType === 'STORY'
```
Then on the carousel tab button: `disabled={storySelected}` + add tooltip "Carousel not supported for Stories".

---

#### 4c. ComposeDialog — include post types in buildInput()

`buildInput()` currently returns a `SchedulePostInput`. We extend it to pass through the post types.

In `buildInput()`, add to the returned object:
```ts
instagram_post_type: selectedPlatforms.includes('instagram') ? instagramPostType : undefined,
facebook_post_type:  selectedPlatforms.includes('facebook')  ? facebookPostType  : undefined,
```

Also update the `SchedulePostInput` type in `lib/hooks/use-posts.ts` to include these optional fields, and ensure the hook's fetch call passes them through to the API route body.

---

#### 4d. BulkRow interface + BulkScheduleDialog

**Update BulkRow:**
```ts
interface BulkRow {
  id: string
  scheduled_at: string
  platforms: SocialPlatform[]
  caption: string
  media_url: string
  media_urls_extra: string
  // NEW
  instagram_post_type: 'POST' | 'REEL' | 'TRIAL_REEL' | 'STORY'
  facebook_post_type: 'POST' | 'REEL' | 'STORY'
  platform_media: Partial<Record<SocialPlatform, string>>  // per-platform URL overrides
  expanded: boolean  // UI: whether per-platform media inputs are shown
  status: 'pending' | 'scheduling' | 'scheduled' | 'draft' | 'failed'
  error?: string
}
```

**Update `newRow()`:**
```ts
function newRow(): BulkRow {
  return {
    id: Math.random().toString(36).slice(2),
    scheduled_at: '', platforms: ['instagram'], caption: '',
    media_url: '', media_urls_extra: '',
    instagram_post_type: 'POST', facebook_post_type: 'POST',
    platform_media: {}, expanded: false,
    status: 'pending',
  }
}
```

**Table — new "Post Type" column (after Platforms column):**

Header: `<th>Type</th>`

Cell per row:
```tsx
<td className="px-3 py-2 min-w-[130px]">
  {row.platforms.includes('instagram') && (
    <div className="flex gap-0.5 mb-1">
      {(['POST','REEL','TRIAL_REEL','STORY'] as const).map(t => (
        <button key={t} onClick={() => updateRow(row.id, { instagram_post_type: t })}
          className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors',
            row.instagram_post_type === t
              ? 'bg-novax-light border-novax-border text-novax'
              : 'border-slate-200 text-slate-400 hover:border-slate-300')}>
          {t === 'TRIAL_REEL' ? 'Trial' : t[0] + t.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  )}
  {row.platforms.includes('facebook') && (
    <div className="flex gap-0.5">
      {(['POST','REEL','STORY'] as const).map(t => (
        <button key={t} onClick={() => updateRow(row.id, { facebook_post_type: t })}
          className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors',
            row.facebook_post_type === t
              ? 'bg-novax-light border-novax-border text-novax'
              : 'border-slate-200 text-slate-400 hover:border-slate-300')}>
          {t[0] + t.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  )}
</td>
```

**Media cell — add expand toggle for per-platform overrides:**

Below the existing two inputs (main URL + carousel), add:
```tsx
{row.media_url && row.platforms.length > 1 && (
  <button
    onClick={() => updateRow(row.id, { expanded: !row.expanded })}
    className="mt-1 text-[10px] text-novax-muted hover:text-novax font-medium flex items-center gap-1"
  >
    <Layers className="w-3 h-3"/>
    {row.expanded ? 'Hide per-platform media' : 'Per-platform media'}
  </button>
)}
{row.expanded && (
  <div className="mt-1.5 space-y-1 pl-1 border-l-2 border-novax-light">
    {BULK_PLATFORMS.filter(p => row.platforms.includes(p)).map(p => (
      <div key={p} className="flex items-center gap-1.5">
        <PlatformIcon platform={p} size="xs"/>
        <input
          type="url"
          value={row.platform_media[p] ?? ''}
          onChange={e => updateRow(row.id, { platform_media: { ...row.platform_media, [p]: e.target.value } })}
          placeholder={`${PLATFORM_CONFIG[p].label} — uses default if blank`}
          className="flex-1 px-2 py-1 border border-slate-200 rounded text-[10px] text-slate-700 placeholder:text-slate-300 outline-none focus:border-novax-muted bg-white"
        />
      </div>
    ))}
  </div>
)}
```

**Update `scheduleAll()` to handle per-platform media and post types:**

```ts
async function scheduleAll() {
  if (!selectedClient) return
  setScheduling(true)
  for (const row of rows) {
    if (!row.caption.trim() || !row.scheduled_at || !row.platforms.length) continue
    updateRow(row.id, { status: 'scheduling' })
    try {
      // Group platforms by effective media URL
      const groups = new Map<string, SocialPlatform[]>()
      for (const p of row.platforms) {
        const url = row.platform_media[p] || row.media_url
        if (!groups.has(url)) groups.set(url, [])
        groups.get(url)!.push(p)
      }

      let anyDraft = false
      for (const [url, plats] of groups) {
        // Resolve Drive proxy URLs
        let resolvedUrl = url
        if (url && isProxyDriveUrl(url)) {
          resolvedUrl = await importDriveFileToStorage(url)
        }
        const mediaUrls = resolvedUrl ? [resolvedUrl, ...row.media_urls_extra.split('|').map(u => u.trim()).filter(Boolean)] : undefined

        const res = await fetch('/api/metricool/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: selectedClient,
            platforms: plats,
            caption: row.caption,
            media_urls: mediaUrls,
            scheduled_at: new Date(row.scheduled_at).toISOString(),
            instagram_post_type: plats.includes('instagram') ? row.instagram_post_type : undefined,
            facebook_post_type:  plats.includes('facebook')  ? row.facebook_post_type  : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok && !data.saved_as_draft) throw new Error(data.error ?? 'Failed')
        if (data.saved_as_draft) anyDraft = true
      }
      updateRow(row.id, { status: anyDraft ? 'draft' : 'scheduled' })
    } catch (err) {
      updateRow(row.id, { status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }
  setScheduling(false)
  setDone(true)
}
```

---

#### 4e. Excel template + import

**`downloadTemplate()` — new columns (H onwards):**

```ts
const headers = [
  'Date', 'Time', 'Platforms', 'Caption',
  'Media URL', 'Carousel URLs', 'Language',
  'IG Post Type',       // H — new
  'FB Post Type',       // I — new
  'Instagram Media',    // J — new
  'Facebook Media',     // K — new
  'TikTok Media',       // L — new
  'LinkedIn Media',     // M — new
  'Twitter Media',      // N — new
]
```

Example row additions: `'POST'`, `'POST'`, then 5 empty URL columns.

Column widths for new cols: `[{ wch: 14 }, { wch: 12 }, { wch: 52 }, { wch: 52 }, { wch: 52 }, { wch: 52 }, { wch: 52 }]`

Data validations additions:
```ts
{
  sqref: 'H2:H10000',
  type: 'list',
  formula1: '"POST,REEL,TRIAL_REEL,STORY"',
  showDropDown: false, allowBlank: true,
  showErrorMessage: true,
  errorTitle: 'Invalid IG type',
  error: 'Enter: POST / REEL / TRIAL_REEL / STORY',
},
{
  sqref: 'I2:I10000',
  type: 'list',
  formula1: '"POST,REEL,STORY"',
  showDropDown: false, allowBlank: true,
  showErrorMessage: true,
  errorTitle: 'Invalid FB type',
  error: 'Enter: POST / REEL / STORY',
},
```

Instructions sheet: add rows for each new column.

**`handleImportFile()` — parse new columns:**

```ts
const iIgType   = col('ig post') !== -1 ? col('ig post') : col('ig type')
const iFbType   = col('fb post') !== -1 ? col('fb post') : col('fb type')
const iIgMedia  = headers.findIndex(h => h.includes('instagram') && h.includes('media'))
const iFbMedia  = headers.findIndex(h => h.includes('facebook')  && h.includes('media'))
const iTkMedia  = headers.findIndex(h => h.includes('tiktok')    && h.includes('media'))
const iLiMedia  = headers.findIndex(h => h.includes('linkedin')  && h.includes('media'))
const iTwMedia  = headers.findIndex(h => h.includes('twitter')   && h.includes('media'))
```

Then in the row loop, add:
```ts
const igPostType = iIgType >= 0
  ? ((['POST','REEL','TRIAL_REEL','STORY'] as string[]).includes(String(r[iIgType] ?? '').toUpperCase())
      ? String(r[iIgType]).toUpperCase() as 'POST'|'REEL'|'TRIAL_REEL'|'STORY'
      : 'POST')
  : 'POST'

const fbPostType = iFbType >= 0
  ? ((['POST','REEL','STORY'] as string[]).includes(String(r[iFbType] ?? '').toUpperCase())
      ? String(r[iFbType]).toUpperCase() as 'POST'|'REEL'|'STORY'
      : 'POST')
  : 'POST'

const platformMedia: Partial<Record<SocialPlatform, string>> = {}
const pmMap: [number, SocialPlatform][] = [
  [iIgMedia, 'instagram'], [iFbMedia, 'facebook'],
  [iTkMedia, 'tiktok'], [iLiMedia, 'linkedin'], [iTwMedia, 'twitter'],
]
for (const [col, plat] of pmMap) {
  if (col >= 0) {
    const raw2 = String(r[col] ?? '').trim()
    if (raw2) {
      const { url: convUrl, wasDrive } = convertGoogleDriveUrl(raw2)
      platformMedia[plat] = wasDrive && convUrl.startsWith('/') ? `${window.location.origin}${convUrl}` : convUrl
    }
  }
}
```

And include in the imported row object:
```ts
instagram_post_type: igPostType,
facebook_post_type: fbPostType,
platform_media: platformMedia,
expanded: Object.values(platformMedia).some(Boolean),
```

---

### 5. `lib/hooks/use-posts.ts`

Update `SchedulePostInput` type to include:
```ts
instagram_post_type?: 'POST' | 'REEL' | 'TRIAL_REEL' | 'STORY'
facebook_post_type?:  'POST' | 'REEL' | 'STORY'
```

These get passed through in the hook's fetch body to the API route as-is.

---

## Edge Cases & Constraints

| Scenario | Handling |
|----------|----------|
| Story selected + Carousel mode | Disable Carousel tab in ComposeDialog; enforce in UI |
| Trial Reel + no video media | Show warning badge; still allow scheduling (Metricool will reject if truly no video) |
| FB post type = Story, IG = Reel | Both types in one API call — Metricool payload carries both `instagramData` and `facebookData` independently |
| Bulk row: IG Story + FB Post, different media | Single API call with split `instagramData`/`facebookData` but same media — acceptable since stories show differently anyway |
| Bulk row: same platform, different media from default | Per-platform media override kicks in; row splits into multiple API calls |
| Excel import: missing IG/FB type columns | Parser defaults to `'POST'` for both |
| Excel import: mixed case type values | Uppercased before validation |

---

## Build Order

1. `lib/types.ts` — add types (5 min)
2. `lib/metricool.ts` — update `MetricoolScheduleInput` + `schedulePost()` logic (20 min)
3. `lib/hooks/use-posts.ts` — extend `SchedulePostInput` (5 min)
4. `app/api/metricool/schedule/route.ts` — accept + forward new fields (15 min)
5. `app/(app)/publishing/page.tsx` — ComposeDialog post type UI (45 min)
6. `app/(app)/publishing/page.tsx` — BulkRow + BulkScheduleDialog table + scheduleAll() (45 min)
7. `app/(app)/publishing/page.tsx` — Excel template + import parser (30 min)

**Total: ~2.5–3 hours**

---

## Future DB Schema Note

When wiring to Supabase, add to `scheduled_posts` table:

```sql
platform_settings_json jsonb DEFAULT '{}'::jsonb,
-- stores: { "instagram_post_type": "STORY", "facebook_post_type": "POST", "platform_media": {...} }
```

This lets the PATCH (reschedule) handler re-read and re-apply post types + per-platform media without the user having to re-enter them.
