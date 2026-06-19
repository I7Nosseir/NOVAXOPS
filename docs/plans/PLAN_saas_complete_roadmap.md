# NOVAX OPS — COMPLETE SAAS ROADMAP
> Single source of truth for the full transformation from internal agency tool → commercial multi-tenant SaaS.
> Last updated: 2026-06-14

---

## QUICK BRIEF (30-second read)

NOVAX Ops is a fully-featured internal agency platform (pipeline, studio, publishing, approvals, reporting, AI). The goal is to package it as a commercial SaaS that other agencies can sign up for, pay for, and run completely isolated from each other. NOVAX remains the first and forever-free tenant on its own platform.

**What's happening in plain language:**
1. Every agency gets their own workspace (organization). Their data is completely invisible to other agencies.
2. Each plan includes a monthly credit allowance — 1 credit = 1 AI call. This controls costs.
3. A super admin panel lets you see everything across all agencies.
4. White-labeling lets premium customers put their own logo and colors on the platform.
5. Postiz (open-source, self-hosted) replaces Metricool's publishing costs with zero recurring fees and better OAuth flows.
6. A reel analyzer lets teams paste Instagram/TikTok/YouTube URLs and get a 14-stage deep intelligence report powered by Gemini's native video understanding.
7. Stripe handles payment; credits handle usage; everything else is already built.

---

## STATUS BOARD

| Phase | Feature | Status | Estimated Days |
|-------|---------|--------|---------------|
| 0 | Domain → novaxops.com, Resend, env | ✅ DONE | — |
| 1 | Multi-tenancy (TypeScript types, RLS, React context, middleware) | ✅ DONE | — |
| 2a | Error Bank (table + reporter + admin page) | ✅ DONE | — |
| 2b | User Profile page | ✅ DONE | — |
| 3 | Credits system — DB + lib/credits.ts | ✅ DONE | — |
| 3-wire | Wire credits into every AI route | 🔲 PENDING | 2–3 days |
| 4 | White-label CSS injection + OrgBranding types | ✅ DONE | — |
| 4-ui | White-label settings UI (logo upload, color picker) | 🔲 PENDING | 2 days |
| 5 | Stripe billing + checkout + webhook | 🔲 PENDING | 4–5 days |
| 6 | Admin super panel (orgs, errors, usage pages) | ✅ DONE | — |
| 7 | Postiz integration (self-hosted + API client) | 🔲 PENDING | 5–7 days |
| 8 | Reel Intelligence Engine (analyzer page + Gemini routes) | 🔲 PENDING | 4–5 days |
| 9 | Excel bulk team invite (upload XLSX → parse → send) | ✅ DONE | — |
| 10 | Free analytics via platform APIs (Meta, TikTok, YouTube) | 🔲 PENDING | 5–7 days |

**Done: 8 of 14 milestones**
**Remaining: 6 milestones → estimated 22–29 working days**

---

## TIMELINE TO COMPLETION

```
Week 1 (now)      ── Credits wiring (all AI routes get 402 guard)
                   ── White-label settings UI

Week 2            ── Stripe products setup (manual in Stripe dashboard)
                   ── Stripe checkout flow + /pricing page
                   ── Stripe webhook (plan upgrades/downgrades)

Week 3            ── Postiz Docker deploy on VPS
                   ── Postiz API client (lib/postiz.ts)
                   ── Social account connect flow in Settings

Week 4            ── Postiz publishing parallel mode (toggle in Compose)
                   ── Reel Intelligence Engine — page + fetch route
                   ── Reel analyzer — Gemini analysis route

Week 5            ── Reel bulk queue (multiple URLs)
                   ── Platform analytics integration (Meta Insights + TikTok)
                   ── YouTube Analytics integration

Week 6            ── Full QA pass (all orgs isolated, credits enforced, Stripe working)
                   ── Pricing page polish
                   ── Public launch prep
```

**Realistic launch date: 5–6 weeks from today (mid-to-late July 2026)**

---

## PHASE 3-WIRE — CREDIT GUARDS ON AI ROUTES

**Status: PENDING — 2–3 days**

`lib/credits.ts` and the `deduct_credits` RPC are built. What's missing: wiring them into each route.

Pattern to apply to every AI API route:
```typescript
// At the top of every route that calls Claude or Gemini:
const { allowed, reason } = await checkAndDeductCredits(orgId, userId, CREDIT_COST['agent_type'])
if (!allowed) {
  return NextResponse.json(
    { error: reason === 'user_daily_cap' ? 'Daily credit limit reached' : 'Organization credit limit reached' },
    { status: 402 }
  )
}
```

CREDIT_COST map (already in `lib/credits.ts`):
| Cost | Operations |
|------|-----------|
| 1 credit | post_caption, task_analyzer, moderation_reply |
| 2 credits | copywriter, researcher, studio_chat |
| 3 credits | studio_content, studio_hooks, reel_analysis |
| 5 credits | studio_strategy, boss_brief, campaign |

Routes to update (ordered by priority):
1. `app/api/ai/route.ts` — all task AI agents
2. `app/api/studio/content/[id]/script/route.ts`
3. `app/api/studio/hooks/generate/route.ts`
4. `app/api/studio/strategy/route.ts`
5. `app/api/studio/campaign/generate/route.ts`
6. `app/api/studio/chat/route.ts`
7. `app/api/studio/visual/route.ts`
8. `app/api/moderation/*/route.ts` — AI reply
9. `app/api/assistant/chat/route.ts`
10. `app/api/ceo/*/route.ts`

---

## PHASE 4-UI — WHITE-LABEL SETTINGS UI

**Status: PENDING — 2 days**

Backend done (types, CSS injection, OrgContext). Need: settings UI.

New "Branding" tab in `/settings` (visible only if plan = white_label OR admin):
- App name text input → `organizations.branding.app_name`
- Primary color picker → `organizations.branding.primary_color`
- Logo upload → Supabase Storage `logos/{orgId}.png` → `organizations.branding.logo_url`
- Favicon upload → `organizations.branding.favicon_url`
- Custom domain input + CNAME instructions
- Live preview panel showing sidebar/header with new branding
- Save → `PATCH /api/org/branding`

---

## PHASE 5 — STRIPE BILLING

**Status: PENDING — 4–5 days**

### Pricing tiers to create in Stripe dashboard:

| Tier | Monthly | Annual | Credits/mo | Max Users | Max Clients |
|------|---------|--------|-----------|-----------|-------------|
| Trial | Free | — | 100 | 3 | 2 |
| Starter | $89 | $79 | 800 | 8 | 5 |
| Growth | $219 | $189 | 3,000 | 20 | 15 |
| Agency | $449 | $389 | 12,000 | Unlimited | Unlimited |
| White Label | Custom ($599+) | Custom | Custom | Unlimited | Unlimited |

### What to build:
1. `/pricing` page — comparison table, "Start Trial" (no card) + "Upgrade" CTA
2. `POST /api/billing/create-checkout` → Stripe Checkout session
3. `POST /api/webhooks/stripe` → handle: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. `GET /api/billing/portal` → Stripe Customer Portal link
5. Settings → "Billing" tab: current plan, usage bars, upgrade button, invoice history

---

## PHASE 7 — POSTIZ INTEGRATION

**Status: PENDING — 5–7 days**

Postiz is self-hosted (Docker). One instance, one workspace per NOVAX org. It handles OAuth for Instagram, TikTok, LinkedIn, X, YouTube, Pinterest — no need for NOVAX to register its own Meta App.

### What to build:
1. Deploy Postiz on a separate VPS ($5–10/mo DigitalOcean)
2. `lib/postiz.ts` — API client:
   - `createWorkspace(orgId)` → called on new org signup
   - `connectSocialAccount(workspaceId, platform)` → returns OAuth URL
   - `schedulePost(workspaceId, post)` → creates a post
   - `getPostAnalytics(workspaceId, postId)` → post stats
3. Settings → "Social Accounts" section: per-platform connect buttons
4. Compose dialog → "Publish via" toggle: Metricool | Postiz
5. Once stable per org, set `publishing_provider = 'postiz'` in org settings

### Migration path:
- Metricool stays as fallback during transition
- Once org confirms Postiz works → admin flips flag → Metricool hidden from that org

---

## PHASE 8 — REEL INTELLIGENCE ENGINE

**Status: PENDING — 4–5 days**

This is the deepest analytical feature in the platform. Gemini 2.0 Flash processes video files natively (reads every frame, audio, text overlays). Cost: ~$0.0015 per reel.

### Analysis prompt stored at:
`lib/prompts/reel-intelligence.ts` → `REEL_INTELLIGENCE_PROMPT`

The prompt runs a 14-stage analysis:
1. Content extraction (type, awareness level, sophistication)
2. Attention analysis (first 3 seconds, hook scoring)
3. Structure decomposition (timeline blocks with purpose + emotion)
4. Psychological analysis (35+ triggers scored 1-10)
5. Story analysis (conflict, stakes, emotional arc)
6. Copywriting analysis (headline, promise, CTA, objection handling)
7. Filmmaking analysis (camera, editing, pacing, captions)
8. Retention engine (dead zones, estimated drop-off curve)
9. Virality factors (14 dimensions, overall viral score /100)
10. Persuasion architecture (core desire, enemy, big idea, hidden belief)
11. Format extraction (reusable framework for the niche)
12. Content DNA (style similarity ranking)
13. Improvement versions (8 versions with predicted performance)
14. Knowledge extraction (principles, models, formulas)

Output format: structured JSON so the UI can render each section as a card.

### What to build:

**Page:** `app/(app)/studio/reel-analyzer/page.tsx`
- URL input (single) or multi-line textarea (bulk, one per line)
- "Analyze" button → starts job
- Results rendered as expandable section cards (one per stage)
- Viral score shown as a large dial gauge
- Retention curve shown as a line chart (Recharts)
- Reusable framework exportable to a Task or Document

**Routes:**
- `POST /api/studio/reel-analyzer/fetch` — download video from URL via Apify or yt-dlp, upload to Gemini Files API, return file URI
- `POST /api/studio/reel-analyzer/analyze` — takes Gemini file URI + metadata, runs `REEL_INTELLIGENCE_PROMPT`, returns structured JSON
- `POST /api/studio/reel-analyzer/bulk` — creates a queue job in `reel_analysis_jobs` table, processes up to 50 URLs sequentially

**DB migration** (`039_reel_analyzer.sql`):
```sql
CREATE TABLE reel_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  urls TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending | processing | done | failed
  results JSONB,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**Credit cost:** 3 credits per reel analyzed.

**Video fetch strategy (in priority order):**
1. Apify Instagram Reel scraper → direct MP4 URL → upload to Gemini (already have Apify key)
2. yt-dlp on server → supports TikTok, YouTube Shorts, Instagram
3. Fallback: extract frames as images (20 frames) → Claude Vision (slower, no audio)

**What Gemini can extract from the video:**
- Every frame visually (composition, text on screen, B-roll, captions)
- Audio track (voiceover, music, sound design)
- Text overlays at timestamp level
- Pacing and cut frequency
- Hook moment identification

**What Gemini CANNOT give you from the video URL:**
- Actual view/like/comment/share counts → need Apify scrape or platform API for those
- Historical performance over time

**Bulk queue UX:**
- Paste up to 50 URLs
- Progress bar per URL (pending → analyzing → done)
- Results appear one by one as they complete
- Total credit cost shown before confirming ("50 reels = 150 credits")
- Results exportable as XLSX or PDF report

---

## PHASE 10 — FREE ANALYTICS (PLATFORM APIS)

**Status: PENDING — 5–7 days (depends on Phase 7 / Postiz OAuth)**

Once users connect accounts via Postiz, we have access tokens. Use them to pull analytics directly from platform APIs (all free).

| Platform | API | Data Available |
|----------|-----|---------------|
| Instagram | Meta Graph API — /insights | Reach, impressions, engagement, follower growth, story tap-through |
| Facebook | Meta Graph API — /insights | Page likes, post reach, engagement rate |
| TikTok | TikTok Display API | Video views, likes, shares, comments, play rate |
| YouTube | YouTube Analytics API | Views, watch time, subscribers, CTR, retention |
| LinkedIn | LinkedIn Marketing API | Impressions, clicks, engagement, follower growth |

New page: `app/(app)/analytics/page.tsx`
- Per-client, per-platform date range selector
- Reach + Impressions + Engagement Rate cards
- Follower growth line chart (Recharts)
- Top performing posts grid (ranked by engagement)
- Export to CSV / PDF

---

## WHAT REMAINS MANUALLY (not code — you do these)

| Task | When |
|------|------|
| Vercel: Set ANTHROPIC_API_KEY in env vars | Now (critical) |
| Supabase SQL Editor: Run migrations 036, 037, 038 | Before next deploy |
| Supabase Auth: Update Site URL → https://www.novaxops.com | Now |
| Supabase Auth: Add redirect https://*.novaxops.com/** | Now |
| Google Cloud Console: Add new OAuth redirect URI | Before Drive is used |
| Stripe: Create 4 products (Starter/Growth/Agency/WhiteLabel) with monthly+annual prices | Week 2 |
| Postiz: Deploy Docker instance on VPS, get API credentials | Week 3 |
| DNS: Add *.novaxops.com wildcard CNAME → cname.vercel-dns.com | When first customer signs up |

---

## ARCHITECTURE AT A GLANCE

```
novaxops.com               → NOVAX org (slug: novax)
acme.novaxops.com          → Acme Agency org (slug: acme)
ops.brandx.com             → BrandX custom domain → BrandX org

middleware.ts reads hostname → stamps x-org-slug header
API routes call getRequestOrgId() → returns UUID
Supabase RLS: every table policy uses get_my_org_id()
is_super_admin() bypass: ismailnosseir7@gmail.com sees ALL orgs
```

```
User action (AI tool use)
  → checkAndDeductCredits(orgId, userId, cost)
  → If allowed: call Claude/Gemini, return result
  → If not: 402 Credit limit reached
  → Credits tracked in organizations.credits_used + users.credits_used_today
  → Monthly reset cron: /api/cron/reset-credits
```

---

## FILES CREATED THIS SESSION

| File | Purpose |
|------|---------|
| `lib/types.ts` | Organization, OrgBranding, OrgPlan types + User extended |
| `lib/org-context.tsx` | OrgProvider + useOrg() hook |
| `lib/org.ts` | Server-side: getRequestOrgId(), getRequestOrg() |
| `lib/error-reporter.ts` | reportError() — inserts to DB + emails on critical |
| `lib/credits.ts` | checkAndDeductCredits() + CREDIT_COST map |
| `lib/white-label.ts` | getOrgBranding() + buildBrandingCSS() |
| `lib/prompts/reel-intelligence.ts` | 14-stage master prompt (stored as constant) |
| `sql/036_rls_org_scoped.sql` | Org-scoped RLS policies for all 24 tables |
| `sql/037_error_events.sql` | error_events table |
| `sql/038_credits.sql` | Credits columns on orgs + users + deduct_credits RPC |
| `app/(app)/profile/page.tsx` | User profile (avatar, name, password, credits display) |
| `app/(admin)/layout.tsx` | Admin shell (dark, auth-guarded, sidebar) |
| `app/(admin)/admin/page.tsx` | Overview stats (6 cards) |
| `app/(admin)/admin/organizations/page.tsx` | All orgs table + status control |
| `app/(admin)/admin/errors/page.tsx` | Error bank with filters + resolve |
| `app/(admin)/admin/usage/page.tsx` | Per-org AI usage this month |
| `app/api/cron/reset-credits/route.ts` | Monthly + daily credit reset cron |
| `app/api/auth/invite/template/route.ts` | Download XLSX invite template |
| `components/settings/bulk-invite-modal.tsx` | + Excel upload (Upload button + XLSX parser) |
| `middleware.ts` | + x-org-slug header stamping from subdomain |

---

## DEFINITION OF DONE

The platform is commercially launchable when:

- [ ] Any agency can sign up, get a workspace, invite their team, and never see NOVAX data
- [ ] Stripe checkout works end-to-end (trial → paid → webhook updates plan in DB)
- [ ] AI usage is gated by credits — 402 returned cleanly when limit hit
- [ ] Admin panel (`/admin`) shows all orgs, all errors, all usage across the system
- [ ] At least one non-NOVAX org can publish content to social (via Postiz)
- [ ] Reel analyzer returns a full intelligence report in under 60 seconds per reel
- [ ] Zero TypeScript errors on `npx tsc --noEmit`
- [ ] All SQL migrations (036–039) have run in Supabase

---

*This file is the single source of truth. Update status column as milestones complete.*
