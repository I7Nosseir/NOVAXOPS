# Approval Portal — Action Plan

> **Goal:** Replace hardcoded mock approval requests with real DB-backed approvals, generate real shareable tokens, make the public client review page read from Supabase, and add email notification when a link is sent.

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| Internal approval page UI | Done — `app/(app)/approval/page.tsx` |
| Public client review page UI | Done — `app/approval/[token]/page.tsx` |
| Per-post approve / request-changes UI | Done |
| Client notes field on public page | Done |
| "Copy Link" button | Done — copies a hardcoded string |

### What is missing
| Piece | Status |
|-------|--------|
| `approvals` table | Not in original schema — must be created |
| `useApprovals()` hook | Does not exist |
| `useCreateApproval()` hook | Does not exist |
| `useUpdateApproval()` hook | Does not exist |
| Internal page reads from DB | No — uses `MOCK_APPROVAL_REQUESTS` constant |
| Public page reads from DB | No — uses hardcoded mock posts |
| Token generation | No — hardcoded UUID string |
| Approval submission writes to DB | No |
| Email notification to client | Not built |

---

## Phase 1 — Database Setup

**Run in Supabase SQL editor:**

```sql
CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  created_by uuid REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  overall_status text DEFAULT 'pending'
    CHECK (overall_status IN ('pending','approved','changes_requested')),
  client_email text,
  client_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE approval_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid REFERENCES approvals(id) ON DELETE CASCADE NOT NULL,
  scheduled_post_id uuid REFERENCES scheduled_posts(id),
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','approved','changes_requested')),
  client_notes text
);

-- RLS
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_posts ENABLE ROW LEVEL SECURITY;

-- Internal (authenticated users can read/write their org's approvals)
CREATE POLICY "auth_select_approvals" ON approvals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_approvals" ON approvals FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_approvals" ON approvals FOR UPDATE USING (auth.role() = 'authenticated');

-- Public (anyone with the token can read the approval)
CREATE POLICY "public_read_approval_by_token" ON approvals FOR SELECT USING (true);
CREATE POLICY "public_read_approval_posts" ON approval_posts FOR SELECT USING (true);
CREATE POLICY "public_update_approval_posts" ON approval_posts FOR UPDATE USING (true);
CREATE POLICY "public_update_approvals_notes" ON approvals FOR UPDATE USING (true);
```

---

## Phase 2 — Hooks

**File to create:** `lib/hooks/use-approvals.ts`

```ts
export function useApprovals(clientId?: string)
  // SELECT * FROM approvals JOIN approval_posts ...
  // ORDER BY created_at DESC

export function useCreateApproval()
  // INSERT INTO approvals (client_id, expires_at, client_email, created_by)
  // INSERT INTO approval_posts (approval_id, scheduled_post_id) for each selected post

export function useUpdateApproval()
  // UPDATE approvals SET overall_status, client_notes WHERE id = ...
  // UPDATE approval_posts SET status, client_notes WHERE id = ...
```

### TypeScript types to add in `lib/types.ts`

```ts
export interface Approval {
  id: string
  client_id: string
  token: string
  created_by: string
  expires_at: string
  overall_status: 'pending' | 'approved' | 'changes_requested'
  client_email?: string
  client_notes?: string
  created_at: string
  posts: ApprovalPost[]
}

export interface ApprovalPost {
  id: string
  approval_id: string
  scheduled_post_id: string
  status: 'pending' | 'approved' | 'changes_requested'
  client_notes?: string
}
```

---

## Phase 3 — Internal Approval Page (Real Data)

**File:** `app/(app)/approval/page.tsx`

### Changes

1. Remove `MOCK_APPROVAL_REQUESTS` constant entirely.
2. Call `useApprovals()` to get real data.
3. "New Request" dialog: on submit, call `useCreateApproval()` with:
   - Selected `client_id`
   - Selected `scheduled_post_id[]` (from `usePosts()` filtered by client, status = 'scheduled' | 'draft')
   - `expires_at` (today + selected days: 3 / 7 / 14)
   - `client_email` (optional — for email notification in Phase 5)
4. On success: `token` comes back from the insert → "Copy Link" now copies `https://{domain}/approval/{token}`.
5. Request cards read from real `approvals` + `approval_posts` data.

### "Copy Link" button

The token is now a real UUID from the DB:

```ts
const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/approval/${approval.token}`
navigator.clipboard.writeText(approvalUrl)
```

Add `NEXT_PUBLIC_APP_URL` to `.env.local`:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Phase 4 — Public Client Review Page (Real Data)

**File:** `app/approval/[token]/page.tsx`

### Changes

This page has no auth — it uses the token from the URL to fetch data.

```ts
// Fetch by token (uses the public RLS policy)
const { data: approval } = await supabase
  .from('approvals')
  .select('*, approval_posts(*, scheduled_posts(*))')
  .eq('token', params.token)
  .gt('expires_at', new Date().toISOString())  // expired tokens return nothing
  .single()
```

If `approval` is null → show "This link has expired or is invalid."

The page then renders the real posts attached to the approval.

### Per-post action

On "Approve" or "Request Changes":

```ts
// Optimistic state update in local state
// Then on "Submit All" button click:
const updates = localPostStatuses.map(ps => ({
  id: ps.approvalPostId,
  status: ps.status,
  client_notes: ps.notes,
}))

// Batch update via API route (not direct Supabase — token auth, not session auth)
await fetch('/api/approvals/submit', {
  method: 'POST',
  body: JSON.stringify({ token, updates, overallNotes }),
})
```

### API route for submission

**File to create:** `app/api/approvals/submit/route.ts`

```
POST /api/approvals/submit
Body: { token, updates: [{ id, status, client_notes }], overallNotes }

1. Verify token exists and is not expired
2. UPDATE each approval_post row
3. Compute overall_status:
   - All 'approved' → overall = 'approved'
   - Any 'changes_requested' → overall = 'changes_requested'
   - Otherwise → 'pending'
4. UPDATE approvals SET overall_status, client_notes = overallNotes
5. Return 200
```

---

## Phase 5 — Email Notification

**Trigger:** When the internal user clicks "Create" and generates the approval link.

### What to send

```
To: {client_email}
Subject: [NOVAX] Your content approval is ready — {client.name}
Body:
  Hi,
  Your content is ready for review.
  Please review and approve by {expires_at_formatted}.
  [Review Content] → {approval_url}
  This link expires in {days} days.
```

### Implementation options (in order of simplicity)

**Option A — Resend (recommended):**
1. Install: `npm install resend`
2. Create API key at resend.com
3. Add `RESEND_API_KEY` to env
4. In `useCreateApproval()` success handler or in the create route, POST to Resend:

```ts
const resend = new Resend(process.env.RESEND_API_KEY)
await resend.emails.send({
  from: 'approvals@yourdomain.com',
  to: clientEmail,
  subject: `[NOVAX] Your content approval is ready — ${clientName}`,
  html: emailTemplate,
})
```

**Option B — Supabase Edge Function:**
More complex setup. Use Option A unless Resend is unavailable.

### Files to create / edit

| File | Change |
|------|--------|
| `app/api/approvals/create/route.ts` | Create — handles insert + email trigger |
| `app/api/approvals/submit/route.ts` | Create — public submit handler |

---

## Phase 6 — Expiry Enforcement

- Expired approvals: `expires_at < now()` → show "Expired" badge in internal view
- Public page: expired token returns nothing → show expired message
- Cron job (optional, later): auto-set `overall_status = 'expired'` on past-due rows via a Supabase scheduled function

---

## Build Order

```
Phase 1a  Run approvals + approval_posts SQL migration
Phase 1b  Add Approval + ApprovalPost types to lib/types.ts

Phase 2a  Create lib/hooks/use-approvals.ts
Phase 2b  useApprovals() — fetch with posts joined
Phase 2c  useCreateApproval() — insert approval + posts
Phase 2d  useUpdateApproval() — update status + notes

Phase 3a  Replace MOCK_APPROVAL_REQUESTS with useApprovals()
Phase 3b  Wire "New Request" dialog to useCreateApproval()
Phase 3c  Wire "Copy Link" to real token URL

Phase 4a  Update public page to fetch by token from Supabase
Phase 4b  Create /api/approvals/submit/route.ts
Phase 4c  Wire "Submit" button on public page to this route
Phase 4d  Add expiry check + expired state UI

Phase 5a  Install Resend, add RESEND_API_KEY to env
Phase 5b  Add client_email field to "New Request" dialog
Phase 5c  Send email on approval creation

Phase 6a  Add "Expired" badge to internal approval cards
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `lib/types.ts` | 1 | Edit |
| `lib/hooks/use-approvals.ts` | 2 | Create |
| `app/(app)/approval/page.tsx` | 3 | Edit |
| `app/approval/[token]/page.tsx` | 4 | Edit |
| `app/api/approvals/submit/route.ts` | 4 | Create |
| `app/api/approvals/create/route.ts` | 5 | Create |
| Supabase SQL editor | 1 | SQL |

---

## Scope Boundary

- **No in-portal client chat** — client communicates via notes field only.
- **No partial re-submission** — once submitted, client cannot reopen. Agency handles changes manually.
- **No approval versioning** — one request = one snapshot in time. If content changes, create a new request.
- **No SMS notification** — email only.
