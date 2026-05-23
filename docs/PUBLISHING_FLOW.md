# Publishing Flow — Canonical Reference

> **DO NOT CHANGE this flow without reading this document first.**
> It is the result of extensive debugging. Every detail here is intentional.

---

## How a post reaches Instagram / Facebook / TikTok

```
User fills ComposeDialog
        ↓
handleSchedule() — app/(app)/publishing/page.tsx
        ↓
[If media is a Google Drive proxy URL]
  importDriveFileToStorage() → downloads from Drive → uploads to Supabase Storage
  resolvedSingleUrl = Supabase public URL (ends in .mp4 / .jpg / etc.)
        ↓
buildInput({ media_url: resolvedSingleUrl })   ← CRITICAL: pass resolved URL directly,
        ↓                                          do NOT rely on setSingleUrl() state update
schedulePost.mutateAsync(input)
        ↓
POST /api/metricool/schedule
        ↓
resolveMediaUrl() — only transforms Google Drive share URLs (not Supabase URLs)
        ↓
schedulePost() — lib/metricool.ts
  1. hasVideo = isVideoOverride ?? imageUrls.some(isVideoUrl) ?? false
  2. normalizeMediaUrl() — Metricool CDN URL returned (contains /video/ for videos)
  3. if (!hasVideo) hasVideo = mediaIds.some(isVideoUrl)   ← re-check after normalization
  4. instagramData = { type: hasVideo ? 'REEL' : 'POST', showReelOnFeed: hasVideo }
  5. facebookData  = { type: hasVideo ? 'REEL' : 'POST' }
  6. tiktokData    = { privacyOption: 'PUBLIC_TO_EVERYONE' }  ← no type field, TikTok auto-handles
        ↓
Metricool API → Instagram / Facebook / TikTok
```

---

## Critical rules — do not break these

### 1. Always pass the resolved URL directly into buildInput

```typescript
// CORRECT
buildInput({ media_url: resolvedSingleUrl || undefined })

// WRONG — setSingleUrl() is async (state update), buildInput() will read stale proxy URL
setSingleUrl(resolvedSingleUrl)
buildInput()
```

`setSingleUrl()` triggers a React re-render. That re-render has NOT happened yet when
`buildInput()` runs in the same async function. The closure captures the old proxy URL.
Passing `resolvedSingleUrl` directly bypasses the stale state entirely.

### 2. Drive proxy URLs must never reach Metricool

`https://yourhost.com/api/proxy/drive?id=xxx` — Metricool cannot process this.
It must be imported to Supabase Storage first → `https://xxx.supabase.co/.../video.mp4`.

The import happens in `handleSchedule` and `handleDraft` via `importDriveFileToStorage()`.
The route that does the actual download+upload is `app/api/proxy/drive/import/route.ts`.

### 3. hasVideo is checked twice — before AND after normalization

```typescript
let hasVideo = isVideoOverride ?? imageUrls?.some(isVideoUrl) ?? false
// ... normalize ...
if (!hasVideo) hasVideo = mediaIds.some(isVideoUrl)
```

Before normalization: catches Supabase URLs ending in `.mp4`, `.mov`, etc.
After normalization: catches everything else — Metricool CDN returns `/video/` in the
path for all video files, regardless of what the original URL looked like.

**Do not collapse these into a single check.**

### 4. Instagram and Facebook need an explicit type field. TikTok does not.

| Platform  | Required field            | Video value           | Image value |
|-----------|---------------------------|-----------------------|-------------|
| Instagram | `instagramData.type`      | `'REEL'`              | `'POST'`    |
| Instagram | `instagramData.showReelOnFeed` | `true`           | omitted     |
| Facebook  | `facebookData.type`       | `'REEL'`              | `'POST'`    |
| TikTok    | `tiktokData.privacyOption`| `'PUBLIC_TO_EVERYONE'`| same        |

TikTok has no `type` field. Setting one would break TikTok posts.

### 5. Confirmed valid instagramData field names (from Metricool API error response)

```
autoPublish, audioName, boostBeneficiary, boost, productTags,
shareTrialAutomatically, collaborators, boostPayer, showReelOnFeed,
tags, type, audioConfiguration, carouselProductTags, carouselTags
```

`showReelOnFeed` is correct. `showReelInFeed` is NOT a valid field (Metricool returns 400).

### 6. The normalize endpoint handles both images and videos

`GET /api/actions/normalize/image/url?url=<media_url>`

Despite the name, this endpoint processes video files too. There is no separate video
normalize endpoint. Confirmed by Metricool official documentation.

---

## Video detection — is_video flag

```
File upload:   handleFileUpload → setIsVideoUpload(file.type.startsWith('video/'))
URL paste:     effectiveUrlIsVideo regex on URL extension
Backend:       isVideoOverride (from is_video body param) → URL extension → CDN path check
```

The `isVideoUpload` state flag and the `effectiveUrlIsVideo` regex feed into `is_video`
in `buildInput`. The backend then uses `isVideoOverride` as the highest-priority signal.

---

## Files involved — touch carefully

| File | Role |
|------|------|
| `app/(app)/publishing/page.tsx` | ComposeDialog — handleSchedule, handleDraft, buildInput |
| `app/api/metricool/schedule/route.ts` | POST (new post), DELETE (cancel), PATCH (retry draft) |
| `app/api/metricool/schedule/edit/route.ts` | PATCH (edit existing scheduled post) |
| `lib/metricool.ts` | schedulePost(), normalizeMediaUrl(), isVideoUrl() |
| `lib/google-drive.ts` | importDriveFileToStorage(), isProxyDriveUrl() |
| `app/api/proxy/drive/import/route.ts` | Downloads Drive file → uploads to Supabase Storage |
| `app/api/proxy/drive/route.ts` | Streams Drive file (preview only — not for Metricool) |

---

## What was broken and why it was hard to find

1. **`showReelOnFeed` vs `showReelInFeed`** — Metricool's own support PDF showed the wrong
   field name. The correct name is `showReelOnFeed`, confirmed only by the 400 error
   response body listing the 14 known fields.

2. **`hasVideo` locked before normalization** — The CDN URL returned by Metricool's
   normalize endpoint contains `/video/` for video files, which is the most reliable
   detection signal. The original code computed `hasVideo` only from the input URL extension,
   before normalization ran. Drive proxy URLs and signed URLs have no extension → `hasVideo`
   was false → Instagram/Facebook got `type: 'POST'` → crashed on video files.

3. **Stale React state in buildInput** — `handleSchedule` correctly imported the Drive
   file to Supabase and called `setSingleUrl(resolvedSingleUrl)`, but React state updates
   are deferred. `buildInput()` ran in the same synchronous context and read the old
   proxy URL from the closure. The resolved Supabase URL was computed and silently
   discarded. Fixed by passing `resolvedSingleUrl` directly as an override to `buildInput`.
