# PLAN: SaaS Transformation
**From internal NOVAX tool → multi-tenant agency platform**
Version: 1.0 · Status: Planning · Start: After orientation

---

## The Core Problem

Current architecture assumes one agency. Every table is flat — no concept of which agency owns which data. Metricool uses NOVAX's single account (clients as "blogIds"). Chatwoot runs as one account. None of this is shareable.

To sell as SaaS: each customer agency must have fully isolated data, their own social connections, their own moderation inbox.

---

## Infrastructure Strategy

```
Your stack (you control everything):
├── Next.js app (Vercel)              ← the product, shared
├── Supabase                          ← all tenant data, isolated via RLS
├── Self-hosted Postiz                ← replaces Metricool, per-workspace
└── Self-hosted Chatwoot              ← already live, per-account isolation
```

### Why Postiz replaces Metricool
- Open source, self-hosted, free infrastructure cost
- Connects directly to platform APIs (Instagram Graph, TikTok, LinkedIn, YouTube, X, Facebook, Pinterest)
- OAuth per social account — each agency connects their own accounts
- Multi-workspace built in — one Postiz instance, unlimited isolated workspaces
- REST API with same conceptual shape as Metricool (schedule, analytics, list)
- AGPL license — fine for SaaS where you host, not distribute

### Why Chatwoot already works for multi-tenancy
Chatwoot supports multiple fully isolated **accounts** on one self-hosted instance.
Per new customer: call Super Admin API → create account → store `chatwoot_account_id` per tenant.
No new infrastructure. One instance, unlimited customers.

---

## Phase 1 — Foundation (Do this even for NOVAX internal use)

### 1.1 Replace Metricool with Postiz
**Why now:** Removes dependency on Metricool pricing. Proves Postiz integration. Required for SaaS anyway.

Files to change:
```
lib/metricool.ts              → lib/postiz.ts (new API client)
app/api/metricool/*           → app/api/postiz/* (same route shape, new calls)
lib/hooks/use-posts.ts        → update to Postiz response format
clients.metricool_blog_id     → clients.postiz_workspace_id (migration)
```

Key Postiz API calls to implement:
- `POST /api/v1/posts` — schedule post
- `DELETE /api/v1/posts/:id` — cancel post
- `GET /api/v1/analytics` — performance data
- `GET /api/v1/posts` — list scheduled content
- Webhook: post published/failed events

**Effort: 2 weeks**

### 1.2 Add organization_id to every table
This is the load-bearing migration. Nothing else works without it.

```sql
-- New table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'starter',           -- starter | growth | scale
  postiz_workspace_id TEXT,
  chatwoot_account_id INTEGER,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add to every table (run in order):
ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE clients ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE tasks ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE scheduled_posts ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE moderation_items ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE approval_requests ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE assets ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE documents ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE studio_sessions ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE post_performance_snapshots ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE audit_log ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE ai_responses ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Seed NOVAX as org_id = 1 and backfill all existing rows
```

**Update all RLS policies** to filter by `organization_id = auth.jwt() ->> 'organization_id'`

**Effort: 3 weeks**

### 1.3 Org-aware auth context
`lib/auth-context.tsx` must expose `currentOrg` alongside `currentUser`.
Every Supabase query threads `organization_id` automatically via a typed client wrapper.

**Effort: 1 week**

---

## Phase 2 — Customer Onboarding

### 2.1 New organization signup flow
When agency signs up:
1. Create `organizations` row
2. Call Postiz API → create workspace → store `postiz_workspace_id`
3. Call Chatwoot Super Admin API → create account → store `chatwoot_account_id`
4. Create first admin user for that org
5. Send invite email via Resend
6. They connect social accounts via Postiz OAuth from inside the app

### 2.2 Billing — Stripe
Plans:

| Plan | Clients | Users | Price (EGP) | Price (USD) |
|---|---|---|---|---|
| Starter | Up to 5 | Up to 5 | 2,500/mo | ~$52 |
| Growth | Up to 15 | Up to 15 | 5,500/mo | ~$115 |
| Scale | Unlimited | Unlimited | 10,000/mo | ~$210 |

Files to add:
```
app/api/billing/create-checkout/route.ts
app/api/billing/webhook/route.ts          ← Stripe webhook
app/api/billing/portal/route.ts           ← customer portal
app/(app)/settings/billing/page.tsx       ← billing tab in settings
```

**Effort: 1.5 weeks**

### 2.3 Super admin dashboard (your view)
Hidden route `/super-admin` — only accessible with super admin flag in DB.
Shows: all orgs, plan, MRR, active users, trial status, usage.

**Effort: 1 week**

---

## Phase 3 — Polish for External Customers

- Custom subdomain per org: `agencyname.yourplatform.com` (Vercel + wildcard DNS)
- Public marketing landing page (separate from the app)
- White-label option: replace NOVAX branding with their agency name (optional)
- Usage limits enforced per plan (client count, user count, AI call quota)
- Email sequences: trial ending, onboarding checklist, tips

**Effort: 2 weeks**

---

## Full Timeline

| Phase | Work | Duration | Dependency |
|---|---|---|---|
| 1.1 | Postiz replaces Metricool | 2w | None — do first |
| 1.2 | organization_id migration | 3w | After 1.1 |
| 1.3 | Org-aware auth | 1w | After 1.2 |
| 2.1 | Signup + provisioning flow | 1w | After 1.3 |
| 2.2 | Stripe billing | 1.5w | After 2.1 |
| 2.3 | Super admin dashboard | 1w | After 2.1 |
| 3 | Polish + subdomain + limits | 2w | After 2.2 |
| **Total** | | **~11.5 weeks** | |

---

## What Does NOT Change

- The product itself: all pages, all studio tools, all AI agents — unchanged
- Supabase Auth: stays as-is, just org-scoped
- Chatwoot: same instance, just a new account per customer
- AI (Claude + Gemini): stays yours — you absorb cost and price it into the plan

---

## First External Customer Strategy

Do not build a public signup page first. Instead:
1. Finish NOVAX internal use — validate product for 4–8 weeks
2. Identify one agency you know (friend, contact) — give them 2 months free
3. Gather real feedback from an external user
4. Fix the pain points they find
5. Then open to more customers

This avoids launching a broken product to strangers.

---

## Resolved Decisions

- Postiz over Metricool: confirmed (open source, no per-seat cost, direct platform API, multi-tenant native)
- Chatwoot: keep self-hosted, one instance, multiple accounts
- Billing: Stripe (most universal, best webhook support)
- Hosting: stay on Vercel + Supabase (scale handles Egyptian + international load)
- License: you own the codebase fully — no open-source obligations on your app
