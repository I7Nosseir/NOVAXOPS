# Publishing & Scheduling — Action Plan

> **Goal:** Make the compose dialog actually save posts to Supabase, schedule them via Metricool, handle media uploads to Supabase Storage, and receive publish confirmations via webhook.

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| Compose dialog UI | Done — full form with client, platforms, language, media, caption, datetime |
| `usePosts()` — reads `scheduled_posts` from Supabase | Done |
| `useUpdatePost()` mutation | Done |
| Grid view + Calendar view toggle | Done |
| Status filter (all/scheduled/published/draft) | Done |
| Excel export for calendar | Done (`xlsx` installed) |

### What is missing
| Piece | Status |
|-------|--------|
| `useCreatePost()` hook | Does not exist |
| "Save Draft" button action | No INSERT anywhere |
| "Schedule" button action | No API call, no Metricool POST |
| Media file upload | No backend — no Supabase Storage upload |
| `/api/publishing/schedule` route | Does not exist |
| `/api/webhooks/metricool` route | Does not exist |
| `metricool_post_id` saved on schedule | Never happens |
| Failed post retry | Not built |
| Arabic/bilingual caption storage | `caption` is a single string — schema needs `caption_ar` or JSON structure |

---

## Phase 1 — Save Draft

**Simplest path. Insert a post with `status = 'draft'`.**

### New hook: `useCreatePost()`

**File:** `lib/hooks/use-posts.ts` — add to existing file

```ts
export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<ScheduledPost, 'id' | 'performance' | 'published_at'>) => {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}
```

### Caption storage for bilingual posts

The current schema stores `caption: string`. For EN/AR/Both, we need structured storage.

**Two options:**

Option A — Add a `caption_ar` column:
```sql
ALTER TABLE scheduled_posts ADD COLUMN caption_ar text;
```

Option B — Store as JSON in `caption`:
```json
{ "en": "English caption...", "ar": "Arabic caption..." }
```

**Use Option A** — simpler to query, simpler to display, no JSON parsing needed at render time.

### Files to edit

| File | Change |
|------|--------|
| `lib/hooks/use-posts.ts` | Add `useCreatePost()` |
| `lib/types.ts` | Add `caption_ar?: string` to `ScheduledPost` |
| `app/(app)/publishing/page.tsx` | Wire "Save Draft" button to `useCreatePost({ status: 'draft', ... })` |
| Supabase SQL editor | `ALTER TABLE scheduled_posts ADD COLUMN caption_ar text` |

---

## Phase 2 — Media Upload to Supabase Storage

**Must happen before scheduling. Metricool needs a public URL for the media.**

### Flow

1. User selects file in compose dialog (PNG, JPG, MP4, max 50MB).
2. File is uploaded to Supabase Storage `assets` bucket (public) under path `posts/{client_id}/{timestamp}_{filename}`.
3. On upload success → public URL returned → stored in `media_url` field.
4. This URL is then passed to Metricool when scheduling.

### Implementation

```ts
// in compose dialog submit handler
async function uploadMedia(file: File, clientId: string): Promise<string> {
  const path = `posts/${clientId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage
    .from('assets')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('assets').getPublicUrl(path)
  return data.publicUrl
}
```

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/publishing/page.tsx` | Add `uploadMedia()` helper, call before submit |

---

## Phase 3 — Schedule via Metricool

**File to create:** `app/api/publishing/schedule/route.ts`

### Flow

```
1. POST /api/publishing/schedule
   Body: { post_id, client_id, caption, caption_ar?, media_url?, platforms[], scheduled_at }
2. Look up client.metricool_blog_id from Supabase
3. For each platform: POST to Metricool API
   POST https://app.metricool.com/api/v2/post
   Headers: X-Mc-Auth: {METRICOOL_API_TOKEN}
   Body: { blogId, content, platform, scheduledAt, mediaUrl }
4. On success: UPDATE scheduled_posts SET status='scheduled', metricool_post_id='{mc_id}' WHERE id=post_id
5. Return { success: true, metricool_post_id }
```

### Metricool API notes

- One API call per platform (Instagram, Facebook, LinkedIn, etc. are separate endpoints)
- `blogId` is per-client (`clients.metricool_blog_id`)
- `scheduledAt` must be ISO 8601 in UTC
- Media: pass `mediaUrl` as a publicly accessible URL (hence Supabase Storage upload first)
- For Arabic captions: send `caption_ar` as the content when `platform = 'instagram'` and language includes AR

### Files to create / edit

| File | Change |
|------|--------|
| `app/api/publishing/schedule/route.ts` | Create |
| `app/(app)/publishing/page.tsx` | Wire "Schedule" button to POST this route |

---

## Phase 4 — Metricool Webhook (Publish Confirmation)

**File to create:** `app/api/webhooks/metricool/route.ts`

### Flow

```
POST /api/webhooks/metricool
Header: X-Mc-Auth: {METRICOOL_API_TOKEN}  (validate this)

Payload:
{
  "event": "post.published",
  "postId": "mc_post_id",
  "publishedAt": "2026-05-16T10:00:00Z"
}

Handler:
1. Validate X-Mc-Auth token matches env var
2. Find: SELECT * FROM scheduled_posts WHERE metricool_post_id = postId
3. UPDATE: status = 'published', published_at = publishedAt
4. Return 200 OK
```

### Configure in Metricool

In the Metricool dashboard under API / Webhooks, set:
```
Webhook URL: https://yourdomain.com/api/webhooks/metricool
```

### Files to create

| File | Purpose |
|------|---------|
| `app/api/webhooks/metricool/route.ts` | Webhook handler |

---

## Phase 5 — Failed Post Retry

**When `status = 'failed'` appears, give the user a retry path.**

### When does failure happen

Metricool returns an error on the schedule API call → our route sets `status = 'failed'` on the post record.

### UI

In the post card (grid view): if `status === 'failed'`:
- Show red "Failed" badge (already styled in `STATUS_CONFIG`)
- Show a "Retry" button
- Retry button → calls `/api/publishing/schedule` again with the same `post_id`

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/publishing/page.tsx` | Add retry button to failed post cards |

---

## Phase 6 — Delete Post

**Simple. Add delete to the post card.**

```ts
export function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('scheduled_posts').delete().eq('id', postId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}
```

Only allow delete on `draft` and `failed` posts. `scheduled` posts should be unscheduled in Metricool first (out of scope for now — just disable delete for scheduled).

---

## Data Shape: `ScheduledPost` (updated)

```ts
interface ScheduledPost {
  id: string
  task_id: string
  client_id: string
  platforms: SocialPlatform[]
  caption: string
  caption_ar?: string           // ADD — Arabic caption
  media_url?: string
  media_urls?: string[]         // ADD — multiple media (carousel)
  scheduled_at: string
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  metricool_post_id?: string    // ADD — returned by Metricool on schedule
  performance?: PostPerformance
  published_at?: string
  language: 'en' | 'ar' | 'both'  // ADD — drives which caption to send
}
```

---

## Build Order

```
Phase 1a  Add useCreatePost() to use-posts.ts
Phase 1b  SQL: ALTER TABLE scheduled_posts ADD COLUMN caption_ar, metricool_post_id, language
Phase 1c  Update mapPost() in use-posts.ts to include new fields
Phase 1d  Update ScheduledPost type in lib/types.ts
Phase 1e  Wire "Save Draft" button in compose dialog

Phase 2a  Add uploadMedia() helper in publishing page
Phase 2b  Wire file input → upload → store URL in form state

Phase 3a  Create /api/publishing/schedule/route.ts
Phase 3b  Wire "Schedule" button to POST this route
Phase 3c  Save metricool_post_id to DB on success

Phase 4a  Create /api/webhooks/metricool/route.ts
Phase 4b  Test with Metricool webhook simulator

Phase 5a  Add retry button to failed post cards

Phase 6a  Add useDeletePost() hook
Phase 6b  Add delete option to draft/failed post cards
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `lib/types.ts` | 1 | Edit |
| `lib/hooks/use-posts.ts` | 1, 6 | Edit |
| `app/(app)/publishing/page.tsx` | 1, 2, 3, 5 | Edit |
| `app/api/publishing/schedule/route.ts` | 3 | Create |
| `app/api/webhooks/metricool/route.ts` | 4 | Create |
| Supabase SQL editor | 1 | SQL |

---

## Scope Boundary

- **No Instagram Stories scheduling** — Metricool supports it but the current UI has no story-specific fields (vertical format, stickers, link). Out of scope.
- **No carousel post UI** — `media_urls[]` field added to type but carousel compose UI is not in scope.
- **No Metricool analytics pull** — analytics pull (reach, ER, impressions) is in the Reports plan.
- **No post editing after scheduling** — would require Metricool unschedule + reschedule. Out of scope.
