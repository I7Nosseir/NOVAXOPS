# PLAN: SaaS Architecture — Deep Technical Design
**NOVAX Ops → Multi-Tenant Agency Platform**
Version: 2.0 · Status: Planning · Authored: 2026-06-11

---

## 1. Current State Assessment

### What exists today
| Layer | State | SaaS-Ready? |
|---|---|---|
| Database schema | Flat — no `organization_id` anywhere | No |
| Row Level Security | Role-based only | No — needs org isolation |
| Social publishing | Metricool single account (clients = blogIds) | No — cannot be shared |
| Comment/DM moderation | Respond.io single account | Partially — Chatwoot replaces this |
| Auth | Supabase Auth, role-based | 80% — needs org claim in JWT |
| AI (Claude + Gemini) | Your keys, absorbed cost | OK — needs per-org quotas |
| Billing | None | 0% |
| Signup flow | None | 0% |
| Email (Resend) | Configured, works | 90% — needs org branding vars |
| File storage | Supabase Storage (single bucket) | Needs org-namespaced paths |

### The one-sentence problem
Every table is flat. There is no concept of which agency owns which data — all rows are globally readable by any authenticated user with the right role.

---

## 2. Multi-Tenancy Strategy Decision

### Option A — Shared Schema + RLS (CHOSEN)
Every table gets `organization_id UUID NOT NULL`. RLS policies filter all queries to the calling user's org. One Supabase project, one schema, one set of migrations.

**Why:**
- Supabase is architected for this pattern — Auth, RLS, Realtime all work natively
- Zero infrastructure complexity — no schema provisioning on signup
- One migration file touches all orgs simultaneously
- Scales to 1000+ orgs without performance issues (with proper indexes)
- Super admin queries across all orgs are trivial (`service_role` bypasses RLS)

### Option B — Schema-per-tenant (REJECTED)
Each org gets their own PostgreSQL schema (`novax.clients`, `acme.clients`, etc.).

**Why rejected:**
- Supabase does not support this natively — requires custom PostgreSQL management
- Migration complexity multiplies with every new org
- Realtime subscriptions break across schemas
- Auth token cannot carry a schema name cleanly

### Option C — Database-per-tenant (REJECTED)
Each org gets their own Supabase project.

**Why rejected:**
- $25+/month per org at Supabase pricing — unit economics break immediately
- No cross-org admin queries
- Deployment complexity is extreme

**Decision: Shared Schema + RLS. This is what Supabase is built for.**

---

## 3. Database Architecture

### 3.1 New Tables

```sql
-- Core multi-tenant anchor
CREATE TABLE organizations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,                          -- "Acme Agency"
  slug                    TEXT UNIQUE NOT NULL,                   -- "acme" → acme.novaxops.com
  plan                    TEXT NOT NULL DEFAULT 'trial',          -- trial | starter | growth | scale
  status                  TEXT NOT NULL DEFAULT 'active',         -- active | suspended | cancelled
  -- Social publishing
  postiz_workspace_id     TEXT,                                   -- assigned on signup
  -- Moderation
  chatwoot_account_id     INTEGER,                                -- assigned on signup
  -- Billing
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  stripe_price_id         TEXT,
  -- Trial
  trial_ends_at           TIMESTAMPTZ,
  -- Plan limits (denormalized for fast enforcement)
  max_clients             INTEGER NOT NULL DEFAULT 5,
  max_users               INTEGER NOT NULL DEFAULT 5,
  ai_calls_per_month      INTEGER NOT NULL DEFAULT 500,
  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Separate from users table — allows one user to belong to multiple orgs (future)
-- For V1: each user belongs to exactly one org via users.organization_id
```

### 3.2 Tables Requiring organization_id (25 tables, in priority order)

Run in this order — each references the previous:

```
Priority  Table                           Notes
────────  ──────────────────────────────  ──────────────────────────────────────
1         users                           Anchor — everything else joins here
2         clients                         Core data unit
3         projects                        References clients
4         tasks                           References clients + projects
5         scheduled_posts                 References clients
6         moderation_items                References clients
7         approval_requests               References clients
8         approval_post_statuses          References approval_requests
9         assets                          References clients
10        documents                       Standalone
11        studio_sessions                 Standalone
12        post_performance_snapshots      References clients
13        competitor_snapshots            References clients
14        competitor_intelligence_reports References clients
15        audit_log                       References users
16        ai_responses                    References tasks
17        api_usage                       References users
18        ai_feedback                     References clients
19        client_context_bank             References clients
20        inspiration_board               References clients
21        format_favorites                Standalone
22        task_comments                   References tasks
23        ceo_context                     References clients
24        arabic_knowledge_base           Shared OR per-org — see §3.3
25        ai_generation_cache             Standalone
```

### 3.3 Special Case: arabic_knowledge_base

Two valid approaches:
- **Shared (simpler):** One global knowledge base, all orgs read the same rules. Admin manages it. `organization_id` is NULL for global rules.
- **Per-org (flexible):** Each org can override with their own rules. `organization_id` filters per org, falls back to global.

**Recommendation:** Start shared (simpler), add per-org override column later if a customer needs custom Arabic rules.

### 3.4 Migration SQL Pattern

```sql
-- Step 1: Add column (non-breaking — nullable first, then enforce NOT NULL after backfill)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Step 2: Backfill NOVAX as the founding org
-- Run AFTER inserting NOVAX into organizations
UPDATE clients SET organization_id = '<novax-org-uuid>';

-- Step 3: Enforce NOT NULL after backfill
ALTER TABLE clients ALTER COLUMN organization_id SET NOT NULL;

-- Step 4: Index (critical for RLS performance — without this every query does a full table scan)
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id);
```

**Repeat for all 25 tables.**

### 3.5 RLS Policy Pattern

Every table gets exactly 3 policies (replacing all current role-only policies):

```sql
-- Helper function (define once, reuse everywhere)
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Service role: full access (for API routes using service_role key)
CREATE POLICY "org_service" ON clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users: read own org only
CREATE POLICY "org_read" ON clients
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

-- Authenticated users: write own org only
CREATE POLICY "org_write" ON clients
  FOR ALL TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
```

**Note:** Role-based restrictions (admin-only tables, ceo-only views) are enforced at the API layer, not RLS. RLS only enforces org isolation. This keeps policies simple and fast.

### 3.6 JWT Custom Claims (org_id injection)

Supabase supports a `custom_access_token_hook` that fires on every token issue/refresh:

```sql
CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.users
  WHERE auth_id = (event->>'user_id')::uuid;

  RETURN jsonb_set(event, '{claims,org_id}', to_jsonb(org_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable in Supabase Dashboard: Authentication → Hooks → Custom Access Token
```

**Alternative (simpler, no hook needed):** Fetch org_id from the users table on every server-side API call using `service_role`. This is what the current codebase already does for role checks — just extend it.

---

## 4. Publishing Layer: Metricool → Postiz

### Why Metricool Cannot Stay for SaaS

Metricool uses a single agency account where clients are identified by `blogId`. This is fundamentally incompatible with multi-tenancy — you can't give each customer agency their own Metricool account without paying per-agency pricing that destroys unit economics.

### Postiz (Open Source Self-Hosted)

Repository: `github.com/gitroomhq/postiz-app`
License: AGPL-3.0 (fine for SaaS where you host, not distribute)

**What Postiz provides:**
- Direct OAuth to Instagram Graph, TikTok, LinkedIn, X (Twitter), Facebook, YouTube, Pinterest
- Multi-workspace: one Postiz instance → unlimited isolated workspaces (one per agency customer)
- Schedule, publish, analytics — same conceptual surface as Metricool
- REST API with Swagger docs
- Self-hosted: Railway.app ($5–15/month), Render, or your own VPS

**API surface map (Metricool → Postiz):**

| Current (Metricool) | Replacement (Postiz) |
|---|---|
| `POST /api/v2/planner/post` | `POST /api/v1/posts` |
| `DELETE /api/v2/planner/post/:id` | `DELETE /api/v1/posts/:id` |
| `GET /api/v2/stats?blogId=X` | `GET /api/v1/analytics?workspace=X` |
| `blogId` per client | `workspaceId` per org |

**Files to change:**
```
lib/metricool.ts              →  lib/postiz.ts
app/api/metricool/*           →  app/api/postiz/*
lib/hooks/use-posts.ts        →  update response shapes
clients.metricool_blog_id     →  clients.postiz_workspace_id (migration)
components/publishing/*       →  minor shape updates
```

**On new org signup:**
1. Call `POST /api/v1/organizations` on your Postiz instance → returns `workspace_id`
2. Store `workspace_id` in `organizations.postiz_workspace_id`
3. User connects their social accounts inside the app via Postiz OAuth redirect
4. No more NOVAX-owned accounts — each customer owns their social connections

### Chatwoot (Already Multi-Tenant)

Chatwoot already supports multiple fully isolated accounts on one self-hosted instance.

**On new org signup:**
1. Call Chatwoot Super Admin API: `POST /auth/sign_in` → `POST /api/v1/accounts`
2. Store `account_id` in `organizations.chatwoot_account_id`
3. Configure webhook to `POST /api/webhooks/chatwoot?org=<org_slug>`

---

## 5. Auth Context Architecture

### Current
`lib/auth-context.tsx` fetches user profile → exposes `user` (id, name, role, etc.)

### New
Extend to fetch and expose `currentOrg`:

```typescript
interface Organization {
  id: string
  name: string
  slug: string
  plan: 'trial' | 'starter' | 'growth' | 'scale'
  status: 'active' | 'suspended' | 'cancelled'
  trial_ends_at: string | null
  max_clients: number
  max_users: number
  ai_calls_per_month: number
}

// In AuthContext:
interface AuthContextValue {
  user: User | null
  currentOrg: Organization | null     // NEW
  loading: boolean
  signOut: () => Promise<void>
  // ...
}
```

**Fetch pattern in auth-context.tsx:**
```typescript
// After fetching user profile, fetch their org:
const { data: org } = await supabase
  .from('organizations')
  .select('id, name, slug, plan, status, trial_ends_at, max_clients, max_users, ai_calls_per_month')
  .eq('id', profile.organization_id)
  .single()
setCurrentOrg(org)
```

### API Route Pattern (all routes, after org migration)

```typescript
// In every API route handler, after auth check:
const { data: profile } = await db
  .from('users')
  .select('id, role, organization_id')
  .eq('auth_id', user.id)
  .single()

const orgId = profile.organization_id

// Thread orgId into all subsequent DB calls
const { data: clients } = await db
  .from('clients')
  .select('*')
  .eq('organization_id', orgId)   // ← every query
```

**This is the only code change in 100+ API routes.** Add one `.eq('organization_id', orgId)` line. RLS would enforce it anyway, but explicit filtering is clearer and catches bugs.

---

## 6. Billing Architecture

### Plans

| Plan | Clients | Users | AI calls/month | Price (USD/month) |
|---|---|---|---|---|
| Trial | 5 | 3 | 100 | Free (14 days) |
| Starter | 5 | 5 | 500 | $49 |
| Growth | 15 | 15 | 2,000 | $99 |
| Scale | Unlimited | Unlimited | Unlimited | $199 |

Price in EGP if billing locally: approx. ×48 exchange rate.

### Stripe Integration

**New routes:**
```
app/api/billing/checkout/route.ts      POST — create Stripe Checkout session
app/api/billing/webhook/route.ts       POST — handle Stripe events
app/api/billing/portal/route.ts        POST — create Stripe Customer Portal session
app/api/billing/usage/route.ts         GET  — current month usage vs plan limits
```

**New page:**
```
app/(app)/settings/billing/page.tsx    — tab in Settings (admin only)
```

**Stripe events to handle:**
| Event | Action |
|---|---|
| `checkout.session.completed` | Activate subscription, set plan, update `organizations` |
| `invoice.payment_succeeded` | Extend subscription period |
| `invoice.payment_failed` | Start 7-day grace period, send warning email |
| `customer.subscription.deleted` | Set org status to `suspended`, block data writes |
| `customer.subscription.updated` | Update plan + limits in `organizations` |

**Enforcement — Middleware Check Pattern:**
```typescript
// lib/plan-guard.ts — call at start of any mutating API route
export async function checkPlanLimits(orgId: string, check: 'client' | 'user' | 'ai_call') {
  const db = createAdminClient()
  const { data: org } = await db
    .from('organizations')
    .select('plan, status, max_clients, max_users, ai_calls_per_month, trial_ends_at')
    .eq('id', orgId)
    .single()

  if (org.status !== 'active') {
    return { allowed: false, reason: 'Subscription inactive.' }
  }

  if (org.plan === 'trial' && org.trial_ends_at && new Date(org.trial_ends_at) < new Date()) {
    return { allowed: false, reason: 'Trial expired. Please upgrade to continue.' }
  }

  if (check === 'client') {
    const { count } = await db.from('clients').select('*', { count: 'exact', head: true }).eq('organization_id', orgId)
    if (count !== null && count >= org.max_clients) {
      return { allowed: false, reason: `Client limit reached (${org.max_clients} on ${org.plan} plan).` }
    }
  }
  // Similar for user and ai_call checks
  return { allowed: true }
}
```

---

## 7. Customer Onboarding Flow

### New Organization Signup (3 steps, <2 minutes)

```
Step 1: /signup
  - Agency name
  - Your name
  - Work email
  - Password
  → Creates: organizations row (trial, 14 days) + users row (admin role)
  → Sends: Welcome email via Resend

Step 2: /onboarding/connect
  - Connect social accounts via Postiz OAuth
  - (Or skip — can connect later in Publishing)
  → Creates: Postiz workspace + Chatwoot account (background)

Step 3: /onboarding/invite
  - Invite team members (email + role)
  - (Or skip — can invite later in Settings)
  → Sends: Invite emails via Resend
  → Redirects to /dashboard
```

### New routes needed:
```
app/(auth)/signup/page.tsx
app/(auth)/onboarding/connect/page.tsx
app/(auth)/onboarding/invite/page.tsx
app/api/auth/signup/route.ts            POST — creates org + user
app/api/auth/provision/route.ts         POST — provisions Postiz + Chatwoot (called async)
```

---

## 8. Super Admin Dashboard

**Route:** `/super-admin`
**Access:** `users.is_super_admin = true` (boolean column, not a role)
**Purpose:** Your view across ALL organizations — not visible to any customer.

### Columns to add to `users`:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;
```

### Dashboard sections:
```
Stats bar:
  Total orgs | Active paying | Trials active | Trials expired | MRR

Organizations table:
  Name | Plan | Status | Clients used/max | Users used/max |
  AI calls this month | Last activity | Trial ends / Renews on | Actions

Actions per org:
  - View as this org (impersonate for debugging — never changes data)
  - Extend trial (+7 days)
  - Change plan
  - Suspend / unsuspend
  - Delete (with confirmation)

Revenue section:
  MRR by plan breakdown | New this month | Churn this month | Net MRR change
```

### API routes:
```
app/api/super-admin/orgs/route.ts       GET — all orgs with stats
app/api/super-admin/orgs/[id]/route.ts  PATCH — change plan/status/trial
app/api/super-admin/revenue/route.ts    GET — MRR breakdown from Stripe
```

---

## 9. Subdomain Routing

**Pattern:** `acme.novaxops.com` → resolves to Acme agency's workspace.

### DNS Setup
- Vercel: add wildcard domain `*.novaxops.com` pointing to same deployment
- TXT verification: `_vercel.novaxops.com`

### Middleware (middleware.ts extension)
```typescript
// Add to existing middleware.ts
const host = req.headers.get('host') ?? ''
const parts = host.split('.')
const isSubdomain = parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'app'

if (isSubdomain) {
  const slug = parts[0]
  // Resolve org slug → org_id, inject into request headers
  // The API layer reads this header to scope queries correctly
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-org-slug', slug)
  return NextResponse.next({ request: { headers: requestHeaders } })
}
```

### White-label Support (Phase 4)
Each org can configure a custom domain (`app.acmeagency.com`). Store in `organizations.custom_domain`. Vercel supports this via their Domains API — automatically provision SSL.

---

## 10. Storage Architecture

### Current
Single bucket: `assets` (public)

### Multi-tenant
Namespaced paths within the same bucket:
```
assets/<org_id>/<client_id>/<filename>
```
RLS on storage uses the same `get_my_org_id()` function to restrict access:
```sql
-- Storage policy
CREATE POLICY "org_storage_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assets' AND
    (storage.foldername(name))[1] = get_my_org_id()::text
  );
```

No bucket changes needed — paths enforce isolation.

---

## 11. Phase-by-Phase Implementation Plan

### Phase 0 — Internal Polish (2 weeks) — DO THIS FIRST
Finish the current product gaps before any multi-tenant work:

- [ ] Set `ANTHROPIC_API_KEY` in production
- [ ] Finish Respond.io reply sender
- [ ] Wire `format_favorites` persistence
- [ ] Team activity monitoring page (in progress)
- [ ] Validate platform with NOVAX team daily for 4+ weeks

**Gate:** Do NOT start Phase 1 until the team uses this daily and it feels solid.

---

### Phase 1 — Multi-Tenant Foundation (4 weeks)

#### 1A — Organizations Table + NOVAX Seed (2 days)
```sql
-- Create organizations table (§3.1)
-- Insert NOVAX as founding org
INSERT INTO organizations (id, name, slug, plan, status, max_clients, max_users, ai_calls_per_month)
VALUES (gen_random_uuid(), 'NOVAX', 'novax', 'scale', 'active', 999, 999, 999999);
-- Note the UUID — use it in 1B backfill
```

#### 1B — Add org_id to all 25 tables (4 days)
One migration file (`025_organization_id.sql`). For each table:
1. Add nullable column
2. Backfill with NOVAX org UUID
3. Set NOT NULL
4. Add index

#### 1C — Rewrite RLS Policies (3 days)
Drop all existing policies. Add `get_my_org_id()` function. Apply 3-policy pattern (§3.5) to all 25 tables. Test with two test orgs.

#### 1D — Org-Aware Auth Context (2 days)
- Update `lib/auth-context.tsx` to fetch + expose `currentOrg`
- Update 100+ API routes to thread `organization_id` into queries
- This is mechanical — find-replace pattern: `await db.from('table').select()` → `await db.from('table').select().eq('organization_id', orgId)`

#### 1E — Postiz Integration (10 days)
- Deploy Postiz to Railway.app
- Write `lib/postiz.ts` API client
- Port `app/api/metricool/*` routes to Postiz shapes
- Update `lib/hooks/use-posts.ts` response shapes
- Run Metricool and Postiz in parallel for 1 week, validate parity
- Cut over, deprecate Metricool routes

**Phase 1 total: ~3.5 weeks**

---

### Phase 2 — Billing + Onboarding (3 weeks)

#### 2A — Stripe Billing (5 days)
- Create products + prices in Stripe Dashboard
- Implement `app/api/billing/checkout/route.ts`
- Implement `app/api/billing/webhook/route.ts` (handle 5 events from §6)
- Implement `app/api/billing/portal/route.ts`
- Add billing tab to Settings (admin only)

#### 2B — Signup + Org Provisioning (4 days)
- Create `app/(auth)/signup/page.tsx`
- Create `app/api/auth/signup/route.ts`
- Create `app/api/auth/provision/route.ts` (async: Postiz workspace + Chatwoot account)
- Wire Resend welcome email

#### 2C — Super Admin Dashboard (3 days)
- Create `/super-admin` page
- Implement `app/api/super-admin/orgs/route.ts`
- Add `is_super_admin` column to `users`

**Phase 2 total: ~2.5 weeks**

---

### Phase 3 — External Customer Readiness (2 weeks)

#### 3A — Subdomain Routing (2 days)
- Vercel wildcard DNS
- Middleware extension (§9)

#### 3B — Usage Limit Enforcement (3 days)
- Implement `lib/plan-guard.ts`
- Wire into: new client creation, new user invite, AI call routes
- UI: upgrade prompts when limits hit

#### 3C — Onboarding Polish (3 days)
- Multi-step onboarding flow (§7)
- Trial ending email sequence (Resend): 7 days out, 3 days out, expired
- In-app trial banner when < 5 days remain

#### 3D — First External Customer (ongoing)
- Give 1–2 known agencies 2 months free
- Real feedback from non-NOVAX users
- Fix what breaks

**Phase 3 total: ~2 weeks + ongoing**

---

### Full Timeline

```
Today         Phase 0: Internal polish                    2 weeks
Week 3        Phase 1A+1B: DB foundation + org_id         1 week
Week 4-5      Phase 1C+1D: RLS + auth context             1.5 weeks
Week 4-7      Phase 1E: Postiz (parallel with 1C/1D)      2 weeks
Week 7-8      Phase 2A: Stripe billing                    1.5 weeks
Week 8-9      Phase 2B+2C: Signup + super admin           1.5 weeks
Week 9-10     Phase 3A-3C: External readiness             2 weeks
Week 10+      Phase 3D: First external customer           Ongoing

Total: ~10 weeks to external customer ready
```

---

## 12. What Does NOT Change

| Thing | Status |
|---|---|
| All pages, studio tools, AI agents | Zero changes to UI |
| Supabase Auth | Stays — just org-scoped |
| Claude + Gemini | Stays — add per-org quotas |
| Vercel hosting | Stays |
| Resend emails | Stays — add org name var |
| shadcn/ui + Tailwind | Stays |
| All existing API routes | Change: one `.eq('organization_id', orgId)` line each |

The product is built. The gap is entirely infrastructure and data isolation.

---

## 13. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RLS policy miss — data leak between orgs | Medium | Critical | Automated test suite: create 2 orgs, verify no cross-reads |
| Postiz API shape mismatch | Medium | High | Run both in parallel for 1 week before cutover |
| Stripe webhook replay attacks | Low | High | Verify webhook signature on every event |
| Subdomain DNS propagation delay | Low | Medium | Test with staging subdomain first |
| org_id backfill corrupts data | Low | Critical | Backup entire database before running migration |

### The non-negotiable before any external customer:
**Automated cross-org data isolation test.** Two orgs, one test script, verified that no client/task/post from Org A is ever returned to Org B. Run this on every deploy.

---

## 14. First External Customer Strategy

**Do NOT:**
- Build a public landing page or marketing site first
- Open signups before having 2 happy external users
- Charge before they've been using it for 2+ weeks

**Do:**
1. Finish NOVAX internal use — validate the product with your own team for 4–6 weeks post Phase 1
2. Identify 1–2 agencies you know personally — give them 2 months completely free
3. Set up a WhatsApp group with them — get feedback in real-time
4. Fix what they find before opening to more customers
5. Only then: build landing page, open public signups, start charging

**Pricing strategy for first 5 external customers:**
Give them founder pricing at 40% off the public price in exchange for a testimonial and feedback calls.

---

## 15. Key Resolved Decisions

| Decision | Choice | Reason |
|---|---|---|
| Multi-tenancy model | Shared schema + RLS | Supabase-native, simpler ops, scales fine |
| Publishing layer | Postiz (self-hosted) | Open source, multi-workspace native, no per-seat cost |
| Moderation | Chatwoot (existing self-hosted) | Already multi-account, no change needed |
| Billing | Stripe | Best webhook support, most universal |
| Hosting | Vercel + Supabase (stay) | Works at scale, no reason to move |
| Auth | Supabase Auth (stay) | Just add org_id claim |
| AI cost model | Absorbed in plan price | Simpler than per-org billing; price plans to cover it |
| White-label | Optional, Phase 3+ | Not needed for first external customers |
| Schema-per-tenant | Rejected | Not Supabase-native, high migration complexity |
