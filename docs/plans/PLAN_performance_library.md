# Plan: Performance Library

**Status:** Not built — planning phase  
**Priority:** High — differentiates platform from generic schedulers  
**Estimated complexity:** Large (3–4 sessions)

---

## What it is

A living intelligence layer that ingests every published post's performance data, identifies what works and what doesn't, monitors competitors, and generates specific recommendations for the next piece of content — per client, per platform, per content type.

This is not a dashboard. It is a learning system that gets smarter the more content the client publishes.

---

## Data Sources

### 1. Own Content (via Metricool)
- `GET /api/metricool/analytics` already exists and calls `getStats()` from `lib/metricool.ts`
- Per-post breakdown: reach, impressions, engagement rate, likes, comments, shares, saves, link clicks
- Platform breakdown: Instagram, TikTok, LinkedIn, Facebook, Twitter/X, YouTube
- Pulled on a schedule (daily cron or on-demand per client)

### 2. Competitor Monitoring
- Input: list of competitor handles per platform (collected in New Client Wizard step 3)
- Approach: scrape public profile data via Metricool's competitor analysis API (if available) OR use a dedicated scraping route
- Fallback: manual import — user pastes competitor metrics from their native app dashboards
- Store in new `competitor_snapshots` table in Supabase

### 3. Viral Pattern Signals
- Filter own posts for top 20% by engagement rate → label as "viral"
- Filter bottom 20% → label as "underperforming"
- Extract features: caption length, has_media, media_type (image/video/carousel), platform, day_of_week, hour, hashtag_count, language, content_theme (AI-labeled)
- Run Claude analysis on patterns → store conclusions in `client_intelligence` JSONB field

---

## Database Changes

```sql
-- New table: competitor snapshots
CREATE TABLE competitor_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  competitor_handle text NOT NULL,
  followers int,
  avg_er numeric(5,2),
  top_content_types jsonb, -- e.g. {"video": 60, "carousel": 30, "image": 10}
  posting_frequency numeric(4,1), -- posts per week
  captured_at timestamptz DEFAULT now()
);

-- New table: content performance snapshots (augments scheduled_posts)
CREATE TABLE post_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  captured_at timestamptz DEFAULT now(),
  reach int,
  impressions int,
  likes int,
  comments int,
  shares int,
  saves int,
  link_clicks int,
  engagement_rate numeric(5,2),
  platform text NOT NULL
);

-- Add to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS performance_intel jsonb DEFAULT '{}';
-- Stores: viral_patterns, content_recommendations, last_analyzed_at
```

---

## Page: `/performance` (new page)

### Tab 1: Content Performance
- Date range picker (last 7d / 30d / 90d / custom)
- Client selector
- Grid of published posts sorted by ER descending
- Each card: thumbnail, caption preview, platform icons, reach, ER, likes, comments
- Color coding: top 20% = emerald border, bottom 20% = red border, middle = slate
- "Viral" badge on standout posts
- Click a post → detail slide-over with full metrics + AI insight ("This post outperformed because...")

### Tab 2: Competitor Insights
- Add competitor handle + platform
- Shows competitor's top performing content types, posting frequency, average ER
- Side-by-side comparison: client vs competitor average ER per platform
- "Gap Analysis" section: where competitor beats client and by how much

### Tab 3: Pattern Intelligence
- AI-generated analysis updated weekly or on-demand
- Sections:
  - **What's working:** top 3 content patterns with evidence (e.g. "Carousel posts on Instagram get 2.4x your average ER")
  - **What's not working:** bottom patterns with explanation
  - **Optimal posting times:** heatmap grid (day × hour) colored by ER — data from own post history
  - **Content mix recommendation:** pie chart showing current vs recommended mix (e.g. "Increase video from 20% to 40%")
  - **Next 5 content recommendations:** specific briefs with format, platform, caption angle, suggested timing

### Tab 4: Benchmarks
- Industry benchmarks per platform (hardcoded from research, updated manually)
- Visual: client ER vs industry average per platform
- Status badge: Above / At / Below benchmark

---

## API Routes

### `GET /api/performance/posts?client_id=&start=&end=`
- Queries `post_performance_snapshots` joined with `scheduled_posts`
- Returns sorted, enriched post list

### `POST /api/performance/sync?client_id=`
- Calls Metricool analytics API for date range
- Upserts results into `post_performance_snapshots`
- Triggers Claude analysis if last_analyzed_at > 7 days ago

### `GET /api/performance/intelligence?client_id=`
- Returns `clients.performance_intel` JSONB (pre-computed patterns + recommendations)

### `POST /api/performance/analyze?client_id=`
- On-demand trigger: pulls all performance data → sends to Claude with structured prompt
- Claude identifies patterns, generates recommendations, returns structured JSON
- Saves to `clients.performance_intel`
- Prompt template:
  ```
  You are a senior social media strategist. Analyze the following performance data for [CLIENT_NAME].
  
  TOP PERFORMING POSTS (by engagement rate):
  [list of top 10 posts with all metrics, caption, platform, day/time, media type]
  
  UNDERPERFORMING POSTS:
  [list of bottom 10 posts]
  
  POSTING HISTORY SUMMARY:
  [total posts, platform breakdown, media type breakdown, avg ER per platform]
  
  Return a JSON object with:
  {
    "viral_patterns": [...],      // what drives high performance
    "failure_patterns": [...],    // what drives low performance
    "optimal_times": {...},       // platform → best days/hours
    "content_mix_recommendation": {...},
    "next_recommendations": [5 specific content briefs],
    "one_line_summary": "..."     // for the dashboard card
  }
  ```

### `POST /api/performance/competitors`
- Accepts: client_id, competitor_handle, platform
- Attempts Metricool competitor lookup; falls back to storing manual data
- Upserts `competitor_snapshots`

---

## Implementation Order

1. DB migration (competitor_snapshots + post_performance_snapshots + clients.performance_intel column)
2. `/api/performance/sync` route — pulls Metricool data, stores snapshots
3. `/api/performance/analyze` route — Claude pattern analysis
4. Tab 1: Content Performance grid (read from snapshots)
5. Tab 3: Pattern Intelligence display (read from performance_intel)
6. Tab 2: Competitor Insights (add handle → display stored snapshots)
7. Tab 4: Benchmarks (static data display)
8. Add "Sync Performance" button to Publishing page PostCard for published posts
9. Sidebar nav entry: "Performance" between Library and Reports

---

## Future: ML Layer
Once enough data accumulates (3+ months, 100+ posts per client):
- Store feature vectors per post in a `post_features` table
- Train a lightweight regression model (or use Claude with full history) to predict ER given caption + media type + platform + time
- Surface predicted ER on the Compose dialog before publishing
