# Chatwoot Moderation Layer — Integration Plan

## What this replaces
Respond.io → self-hosted Chatwoot on Railway (free, unlimited, owned by us)

## Architecture summary
```
Instagram/Facebook comment or DM
        ↓
Chatwoot (Railway) receives via Meta webhook
        ↓
Chatwoot fires webhook → POST /api/webhooks/chatwoot
        ↓
NOVAX Ops upserts moderation_item in Supabase
        ↓
Moderation queue shows item (pending)
        ↓
Agent clicks "Generate with AI" → Claude writes brand-voice reply
        ↓
Agent clicks "Send" → POST /api/chatwoot/reply → Chatwoot API → DM sent
```

## Auto-DM flow (ManyChat-style, free)
```
User comments on Instagram post
        ↓
Chatwoot receives comment → creates conversation
        ↓
Chatwoot Automation rule fires
        ↓
Auto-DM sent: "Hi [name]! We've replied to you here in your DMs..."
        ↓
Full reply handled by agent or AI in NOVAX Ops moderation queue
```

---

## What's already done

- [x] Chatwoot deployed on Railway (`chatwoot-production-6b93.up.railway.app`)
- [x] SQL migration `018_chatwoot_migration.sql` — adds Chatwoot columns to `moderation_items` + `clients`
- [x] `app/api/webhooks/chatwoot/route.ts` — inbound webhook handler with HMAC verification
- [x] `app/api/chatwoot/reply/route.ts` — outbound reply via Chatwoot REST API
- [x] `app/(app)/moderation/page.tsx` — reply endpoint updated to Chatwoot
- [x] `app/(app)/settings/page.tsx` — integration config updated
- [x] `lib/types.ts` — `Client` + `ModerationItem` types updated
- [x] `.env.local` — all 4 Chatwoot credentials added

## Credentials (in .env.local + Vercel)
```
CHATWOOT_BASE_URL=https://chatwoot-production-6b93.up.railway.app
CHATWOOT_ACCOUNT_ID=2
CHATWOOT_API_TOKEN=AsvQFAPYavTmDw9im5YMgDTz
CHATWOOT_WEBHOOK_SECRET=idNumauDxFCKv5KFuCNfJtmL
```

---

## Remaining steps

### Step 1 — Run SQL migration
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Paste and run `sql/018_chatwoot_migration.sql`

### Step 2 — Add env vars to Vercel
- [ ] Vercel → Project → Settings → Environment Variables
- [ ] Add all 4 `CHATWOOT_*` vars

### Step 3 — Connect Instagram inboxes in Chatwoot
For each client:
- [ ] Chatwoot → Settings → Inboxes → Add Inbox → Instagram
- [ ] Authorize Facebook Page connected to client's Instagram Business account
- [ ] Note the inbox ID (appears in URL after creation)
- [ ] Update `clients.chatwoot_inbox_id` in Supabase for that client

**Prerequisites per client:**
- Instagram account must be a Business or Creator account
- Instagram must be connected to a Facebook Page
- You must be an admin of that Facebook Page

### Step 4 — Map inbox IDs to clients in Supabase
For each connected inbox, run in Supabase SQL Editor:
```sql
UPDATE public.clients
SET chatwoot_inbox_id = <inbox_id_number>
WHERE name = '<client name>';
```

### Step 4b — Add social handles to each client (for Apify scraper)

No Meta App needed. For each client, update their `brand_identity_json` in Supabase:

```sql
UPDATE public.clients
SET brand_identity_json = brand_identity_json || '{
  "instagram_handle": "clientusername",
  "facebook_page_url": "https://www.facebook.com/pagename"
}'::jsonb
WHERE name = '<client name>';
```

The cron `GET /api/cron/scrape-comments` runs every 30 min, reads these handles,
scrapes recent comments via Apify, and populates moderation_items automatically.
No real-time — ~30 min delay. Agents get AI reply drafts and copy-paste to Instagram/Facebook.

### Step 5 — Set up Chatwoot Automation (auto-DM)
For each client inbox:
- [ ] Chatwoot → Settings → Automation → New Automation
- [ ] Event: Conversation Created
- [ ] Condition: Inbox = [client inbox]
- [ ] Action: Send Message → "Hi {{contact.name}}! Thanks for reaching out — we've sent you everything you need right here in your DMs."
- [ ] Save

### Step 6 — Test end to end
- [ ] Comment on a connected Instagram post from a personal account
- [ ] Verify item appears in NOVAX Ops `/moderation` queue
- [ ] Generate AI reply → send → verify DM received on Instagram

---

## Constraints & known limitations

| Limitation | Details |
|---|---|
| Instagram public comment replies | Blocked by Meta without Business API approval. Workaround: auto-DM instead |
| TikTok comments | Not supported by any third-party tool via API |
| Railway free tier | $5 credit (30 days). Add card or migrate to free alternative after trial |
| Reply direction | Only DM replies work. Public comment reply requires Meta approval |

## Cost
| Service | Cost |
|---|---|
| Chatwoot (Railway) | ~$5/month after trial (or migrate to Render free tier) |
| Chatwoot software | Free, open source |
| All automation | Free (built into Chatwoot) |
| NOVAX Ops integration | Free (our own code) |

---

## Railway → Render migration (if needed after $5 trial)
Render.com offers a free tier with no credit card. Chatwoot can be deployed
there via Docker. Migration is a database export/import + redeploy.
Plan this before the Railway trial expires.
