# Content Library — Action Plan

> **Goal:** Make the templates tab read real published posts from Supabase, wire the "star to save" and "use as template" actions, and complete the Google Drive file browser (OAuth covered in ASSET_MANAGEMENT_PLAN).

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| Templates tab UI | Done — post cards with performance tags, copy framework badges |
| Star/save button | Done — local `useState` only, resets on refresh |
| Copy caption button | Done — `navigator.clipboard.writeText()` |
| Search + filter bar | Done — client dropdown, tag filter, text search |
| "Use as template" button | Done — UI only, no action |
| Google Drive tab UI | Done — folder browser, breadcrumb navigation, search |
| Drive connect/disconnect UI | Done — calls stubs |

### What is missing
| Piece | Status |
|-------|--------|
| Templates source | Reads from mock `POSTS` array — should read from `usePosts()` filtered to `status='published'` |
| Star/save persistence | Not persisted — resets on reload |
| "Use as template" action | No implementation |
| `saved_templates` table or field | Not in schema |
| Google Drive routes | Not built (covered in ASSET_MANAGEMENT_PLAN Phase 5) |
| Performance tag derivation | Currently uses `tags` from mock data — needs to derive from real `performance` data |

---

## Phase 1 — Templates from Real Data

**Replace mock post source with real `usePosts()` filtered to published.**

### Current source

The library page imports from mock data or uses a local constant.

### Replacement

```ts
const { posts } = usePosts()
const publishedPosts = posts.filter(p => p.status === 'published' && p.performance)
```

### Performance tag derivation

Tags like "High ER", "Top Reach", "Viral" are currently hardcoded on mock data. Derive them from real performance:

```ts
function getPerformanceTags(post: ScheduledPost): string[] {
  const tags: string[] = []
  if (!post.performance) return tags
  if (post.performance.engagement_rate > 5) tags.push('High ER')
  if (post.performance.engagement_rate > 8) tags.push('Viral')
  if (post.performance.reach > 10000) tags.push('Top Reach')
  if (post.performance.saves > 500) tags.push('Save-worthy')
  if (post.performance.shares > 200) tags.push('Shareable')
  return tags
}
```

No DB changes needed — derived from existing `performance` data already on the post.

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/library/page.tsx` | Replace mock source with `usePosts()`, add `getPerformanceTags()` |

---

## Phase 2 — Star/Save Persistence

**"Star" means saving a post as a reusable template. Persist this.**

### Option: `saved_by` column on `scheduled_posts`

Simplest approach — add a `saved_as_template` boolean per post:

```sql
ALTER TABLE scheduled_posts ADD COLUMN saved_as_template boolean DEFAULT false;
```

### Mutation

```ts
const updatePost = useUpdatePost()

function toggleSave(postId: string, currentlySaved: boolean) {
  updatePost.mutate({ id: postId, saved_as_template: !currentlySaved })
}
```

The templates tab filters by `saved_as_template = true` optionally (or shows all published and indicates which are saved).

### Alternative: per-user saved list

If different users should have different saved templates, a junction table is needed:
```sql
CREATE TABLE user_saved_templates (
  user_id uuid REFERENCES users(id),
  post_id uuid REFERENCES scheduled_posts(id),
  PRIMARY KEY (user_id, post_id)
);
```

**Use the simpler `saved_as_template` column first.** Per-user lists are a future enhancement.

### Files to edit

| File | Change |
|------|--------|
| `lib/types.ts` | Add `saved_as_template?: boolean` to `ScheduledPost` |
| `lib/hooks/use-posts.ts` | Include `saved_as_template` in `mapPost()` |
| `app/(app)/library/page.tsx` | Wire star button to `useUpdatePost()` |
| Supabase SQL editor | `ALTER TABLE scheduled_posts ADD COLUMN saved_as_template boolean DEFAULT false` |

---

## Phase 3 — "Use as Template" Action

**Creates a new draft post pre-filled with the template's caption and platforms.**

### Flow

1. User clicks "Use as template" on a post card.
2. Opens the compose dialog (or a lighter "duplicate" dialog) pre-filled with:
   - Caption from template post
   - Platforms from template post
   - Client from template post
   - Status: `draft`
   - No scheduled date (user picks)
3. User edits and saves/schedules.

### Implementation

The simplest path: open the existing compose dialog with pre-filled state.

```ts
function useAsTemplate(post: ScheduledPost) {
  setComposeDefaults({
    clientId: post.client_id,
    caption: post.caption,
    platforms: post.platforms,
  })
  setComposeOpen(true)
}
```

The compose dialog (PUBLISHING_PLAN) needs to accept optional `defaults` prop.

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/library/page.tsx` | Add `useAsTemplate()` handler |
| `app/(app)/publishing/page.tsx` | Accept `defaults` prop in compose dialog (or export the dialog as a shared component) |

---

## Phase 4 — Google Drive File Browser

**Covered in ASSET_MANAGEMENT_PLAN Phase 5.** The Drive tab UI already exists. This phase just connects it to the real API routes once they're built.

### What the Drive tab currently does

1. Shows "Connect Google Drive" button → calls `/api/drive/auth` (doesn't exist).
2. If connected, shows folder browser → calls `/api/drive/files?folderId=root`.
3. Breadcrumb navigation for subfolders.
4. Search within Drive.
5. "Import to Library" → calls `/api/assets/import-from-drive` (doesn't exist).

### Changes needed (after ASSET_MANAGEMENT_PLAN routes are built)

No UI changes needed in `library/page.tsx`. The Drive tab UI is already complete. Once the API routes exist, it works.

---

## Phase 5 — Copy Framework Tags

**Posts derived from the pipeline can have a "framework" tag (AIDA, PAS, STEPPS) if they were created via the copywriter agent. Display this on the library card.**

### Where framework comes from

When the copywriter agent runs and a variant is selected, the `framework` field (`'AIDA' | 'PAS' | 'STEPPS'`) is part of the selected variant. This should be saved when the post is created.

### Schema addition

```sql
ALTER TABLE scheduled_posts ADD COLUMN copy_framework text;
```

### UI

In the library card, show a small badge: `AIDA`, `PAS`, or `STEPPS` — same styling as performance tags.

---

## Build Order

```
Phase 1a  Replace mock data source with usePosts() filtered to published
Phase 1b  Add getPerformanceTags() derivation function
Phase 1c  Wire search and client filter to real data

Phase 2a  SQL: ALTER TABLE scheduled_posts ADD COLUMN saved_as_template
Phase 2b  Update mapPost() in use-posts.ts
Phase 2c  Wire star button to useUpdatePost()

Phase 3a  Add useAsTemplate() handler
Phase 3b  Ensure compose dialog accepts defaults prop (PUBLISHING_PLAN)

Phase 4   Drive tab — no changes until ASSET_MANAGEMENT_PLAN Phase 5 is done

Phase 5a  SQL: ALTER TABLE scheduled_posts ADD COLUMN copy_framework
Phase 5b  Show framework badge in library card
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `app/(app)/library/page.tsx` | 1, 2, 3 | Edit |
| `lib/types.ts` | 2, 5 | Edit |
| `lib/hooks/use-posts.ts` | 2 | Edit |
| Supabase SQL editor | 2, 5 | SQL |

---

## Scope Boundary

- **No AI caption regeneration from template** — user edits manually in compose dialog.
- **No template categories or folders** — flat list with filters only.
- **No shared template library across clients** — each post belongs to one client.
- **No bulk template import** — one template at a time.
