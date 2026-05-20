# Plan: Metricool at Peak Capabilities

**Status:** Partially implemented — scheduling + delete + reschedule + basic analytics  
**Priority:** High — Metricool is the scheduling backbone of the platform  
**Estimated complexity:** Medium (2 sessions)

---

## What Metricool Can Do (Full API Surface)

Metricool API v2 base: `https://app.metricool.com/api/v2`  
Auth: `X-Mc-Auth: {token}` header, always pass `?userId=&blogId=` query params.

### Currently implemented
| Endpoint | Status | Route |
|---|---|---|
| `POST /scheduler/posts` | Done | `/api/metricool/schedule` POST |
| `DELETE /scheduler/posts/{id}` | Done | `/api/metricool/schedule` DELETE |
| Custom reschedule (delete + recreate) | Done | `/api/metricool/schedule` PATCH |
| `GET /analytics/summary` | Done (basic) | `/api/metricool/analytics` GET |
| Connection test | Done | `/api/metricool/connection` GET |

### Not yet implemented

| Metricool Feature | Value | Priority |
|---|---|---|
| `GET /scheduler/posts` — list all scheduled posts | Sync DB with Metricool (catch posts scheduled outside the app) | High |
| `GET /analytics/posts` — per-post performance breakdown | Power source for Performance Library | High |
| Best time to post analysis | `GET /analytics/best-times` if available, else compute from own data | High |
| Hashtag performance | Which hashtags drove engagement | Medium |
| Competitor tracking (Metricool tracks followers/ER of competitor accounts) | Competitor tab in Performance Library | Medium |
| Auto-publish confirm webhook (already receiving) | Mark posts published in DB | Done |
| Multi-account support (if agency has multiple Metricool workspaces) | Not needed yet | Low |

---

## Feature 1: Scheduled Post Sync

**Problem:** Posts scheduled directly in Metricool dashboard don't appear in NOVAX Ops DB.

**Solution:**
```
GET /api/metricool/sync?client_id=
```
- Calls `GET https://app.metricool.com/api/v2/scheduler/posts?blogId=&userId=`
- Compares returned Metricool post IDs against `scheduled_posts.metricool_post_id`
- For any Metricool post with no matching DB row: creates a draft record in `scheduled_posts`
- For any DB post with no matching Metricool post (but status=scheduled): marks as `failed` (was deleted externally)

Add "Sync with Metricool" button to the Publishing page header. Run sync automatically on page mount.

---

## Feature 2: Per-Post Performance Pull

**Problem:** After a post publishes, we have no engagement data in the DB — only status=published.

**Solution:**
```
GET /api/metricool/post-stats?metricool_post_id=&client_id=
```
- Calls Metricool's per-post stats endpoint
- Upserts into `post_performance_snapshots` (from Performance Library plan)
- Called: when user opens a published post's detail view, or on daily cron

**Cron job:** every morning at 7am, pull stats for all posts published in the last 30 days.
Use a Vercel Cron route: `app/api/cron/sync-performance/route.ts` with `vercel.json` schedule.

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/sync-performance", "schedule": "0 7 * * *" }
  ]
}
```

---

## Feature 3: Best Time to Post

**Problem:** Team guesses when to post. Should be data-driven.

**Solution (computed internally, no separate Metricool endpoint needed):**
- Query `post_performance_snapshots` for a client, group by `day_of_week` and `hour_of_day` (extracted from `scheduled_at`)
- Compute average ER per (day, hour) bucket
- Return heatmap data: 7 days × 24 hours grid with ER value per cell

```
GET /api/performance/best-times?client_id=&platform=
```

Display in Performance Library Tab 3 as a heatmap grid. Also surface in Compose dialog: show "Best time for [Platform]: Tuesday 7pm" based on this client's history.

---

## Feature 4: Publishing Calendar Real Data

**Problem:** Calendar view in Publishing page shows scheduled posts from DB. If posts are scheduled in Metricool outside the app, they don't appear.

**Solution:** After sync (Feature 1), the calendar already shows all posts. Enhance with:
- Color coding by performance (green = published + good ER, gray = published + poor ER, teal = scheduled, yellow = draft)
- Hover on calendar cell → mini tooltip with post thumbnail + metrics
- "Gaps" highlighted: days with no scheduled content shown in light red

---

## Feature 5: Metricool Dashboard Embed (Optional)

Metricool provides a shareable analytics link per blog. If the user wants, we can embed it in an iframe inside the Reports page as a "Live Dashboard" tab.

No API work needed — just the iframe URL from Metricool settings.

---

## Feature 6: Bulk Schedule from Metricool Calendar Data

When the "Generate Content Calendar" dialog produces a week of posts, currently each post is individually submitted to Metricool via separate API calls.

**Improvement:** Batch them into a single UI flow:
1. Show all generated posts in a review list
2. User checks/unchecks which to approve
3. Single "Schedule All" button → parallel `POST /api/metricool/schedule` calls with `Promise.all`
4. Progress bar shows X/Y posts scheduled
5. Failed posts highlighted for retry

---

## Feature 7: Metricool Settings Page Integration

Currently the admin enters a Metricool blog ID per client manually in Supabase.

**Build in the UI:**
- Settings → Integrations tab → Metricool section
- "Connect" button → enters API token → calls `/api/metricool/connection` to verify
- "Configure Clients" section → for each client, a dropdown/input to set their `metricool_blog_id`
- Optional: auto-discover blogs by calling `GET /api/v2/blogs` if Metricool exposes that endpoint

---

## Implementation Order

1. `GET /api/metricool/sync` — scheduled post sync (most impactful, fixes missing posts)
2. `GET /api/metricool/post-stats` — per-post performance pull
3. Vercel cron job for daily performance sync
4. Best time to post computation + heatmap display
5. Compose dialog: show best time suggestion inline
6. Bulk "Schedule All" for calendar generation output
7. Metricool Settings UI (blog ID per client)
8. Calendar gap highlighting

---

## Known Constraints

- Metricool has no OAuth — token only. One token per agency, multiple blogIds.
- Instagram public comment replies are NOT supported (Instagram API restriction). DM replies to commenters work.
- Metricool `publicationDate` must be ISO 8601 with `Z` timezone marker or Java backend fails.
- Rate limits: Metricool API has undocumented rate limits — add 200ms delay between bulk calls.
- Analytics data may have a 24–48h lag for some platforms (Metricool pulls from platform APIs which cache).
