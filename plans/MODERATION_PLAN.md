# Moderation & Community Management — Action Plan

> **Goal:** Build the Respond.io webhook ingestion pipeline, wire the AI reply agent, connect the reply-send button to Respond.io's API, and add realtime queue updates.

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| Moderation queue UI | Done — `app/(app)/moderation/page.tsx` |
| `useModerationItems()` | Done — reads from Supabase `moderation_items` table |
| `useUpdateModerationItem()` | Done — updates status + final_reply in Supabase |
| Status tabs (All / Pending / Replied / Escalated) | Done |
| AI reply generate button | Done — calls `/api/ai` (which doesn't exist yet) |
| Editable reply textarea | Done |

### What is missing
| Piece | Status |
|-------|--------|
| `/api/webhooks/respond-io` route | Does not exist |
| HMAC signature validation | Not built |
| `client_id` mapping from Respond.io channel | Not built |
| Realtime subscription on `moderation_items` | Not built |
| Reply send to Respond.io API | Not built — "Send" button fires `useUpdateModerationItem()` only (saves locally, doesn't send to platform) |
| `moderation_reply` AI agent | Needs `/api/ai` route (covered in AI_AGENT_SYSTEM_PLAN) |
| Platform limitation warning (Instagram comment replies blocked) | Not built |
| Ignored tab | Missing from filter — currently only All/Pending/Replied/Escalated |

---

## Phase 1 — Respond.io Webhook Ingestion

**File to create:** `app/api/webhooks/respond-io/route.ts`

### Respond.io webhook payload

When a comment or DM arrives on a connected platform, Respond.io sends:

```json
{
  "event": "message.created",
  "contact": {
    "name": "User Name",
    "phone": null,
    "externalId": "@user_handle"
  },
  "message": {
    "text": "Love this product!",
    "channel": "instagram_comment",
    "conversationId": "abc123"
  },
  "inbox": {
    "id": "inbox_id_123",
    "name": "Luxe Cosmetics Instagram"
  }
}
```

### HMAC validation

Respond.io signs each webhook with `X-Respond-Signature` header:

```ts
import { createHmac } from 'crypto'

function validateSignature(rawBody: string, signature: string): boolean {
  const expected = createHmac('sha256', process.env.RESPOND_IO_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex')
  return `sha256=${expected}` === signature
}
```

### Inbox → client mapping

Each Respond.io inbox corresponds to one client's platform. The mapping lives in the `clients` table:

```
clients.respond_io_channel_id = "inbox_id_123"
```

In the webhook handler:
```ts
const { data: client } = await supabase
  .from('clients')
  .select('id, name')
  .eq('respond_io_channel_id', body.inbox.id)
  .single()
```

### Platform detection

Map Respond.io channel types to our `SocialPlatform` type:

```ts
const CHANNEL_MAP: Record<string, SocialPlatform> = {
  instagram_comment: 'instagram',
  instagram_dm: 'instagram',
  facebook_comment: 'facebook',
  facebook_dm: 'facebook',
  linkedin_comment: 'linkedin',
  linkedin_dm: 'linkedin',
}
```

### Handler logic

```
POST /api/webhooks/respond-io
1. Buffer raw body (needed for HMAC)
2. Validate X-Respond-Signature → 401 if invalid
3. Parse JSON
4. Map inbox.id → client_id via Supabase lookup
5. Determine platform from message.channel
6. INSERT into moderation_items:
   {
     client_id,
     platform,
     commenter_name: contact.name,
     commenter_handle: contact.externalId,
     comment_text: message.text,
     post_caption: '',    // Respond.io doesn't always send this
     status: 'pending',
     respond_io_conversation_id: message.conversationId,
     created_at: now()
   }
7. Return 200 OK (quickly — Respond.io retries on timeout)
```

### Schema addition

The `moderation_items` table needs one new column:
```sql
ALTER TABLE moderation_items ADD COLUMN respond_io_conversation_id text;
```
This is needed to send replies back (Phase 4 requires the conversation ID).

### Files to create

| File | Purpose |
|------|---------|
| `app/api/webhooks/respond-io/route.ts` | Webhook handler |

---

## Phase 2 — Realtime Queue Updates

**When a new item is inserted by the webhook, the moderation page should update without refresh.**

### Implementation

In `lib/hooks/use-moderation.ts`, add a Supabase Realtime subscription alongside the query:

```ts
export function useModerationItems(clientId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('moderation_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'moderation_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['moderation'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  // ... existing useQuery ...
}
```

This fires on INSERT (new comment), UPDATE (status change), and DELETE.

### Files to edit

| File | Change |
|------|--------|
| `lib/hooks/use-moderation.ts` | Add Supabase Realtime subscription |

---

## Phase 3 — AI Reply Agent

**Already wired in the UI. Just needs `/api/ai` route to exist.**

The moderation page already calls:
```ts
fetch('/api/ai', {
  method: 'POST',
  body: JSON.stringify({
    agent: 'moderation_reply',
    client: { id, name, brand_identity },
    commentText: item.comment_text,
    commenterName: item.commenter_name,
    postCaption: item.post_caption,
    platform: item.platform,
  }),
})
```

Once `/api/ai` is built (AI_AGENT_SYSTEM_PLAN Phase 1), this starts working automatically.

The `moderation_reply` prompt is defined in AI_AGENT_SYSTEM_PLAN Phase 3.

**No code changes needed in the moderation page for this phase.**

---

## Phase 4 — Send Reply to Respond.io

**Currently "Send" only saves the reply locally. It must also post to Respond.io.**

### Flow

1. User edits the AI-suggested reply in the textarea.
2. User clicks "Send".
3. Call `POST /api/moderation/reply` with the conversation ID + reply text.
4. API route posts to Respond.io: `POST https://api.respond.io/v2/contact/{contactId}/message`.
5. On success: `useUpdateModerationItem({ id, status: 'replied', finalReply: reply })`.

### API route

**File to create:** `app/api/moderation/reply/route.ts`

```
POST /api/moderation/reply
Body: { conversationId, replyText, moderationItemId, platform }

1. Validate session (authenticated user only)
2. Check platform:
   - Instagram + type === 'comment' → return 400: "Instagram public comment replies not supported"
   - All others → proceed
3. POST to Respond.io:
   POST https://api.respond.io/v2/message
   Headers: Authorization: Bearer {RESPOND_IO_API_KEY}
   Body: { contactId, message: { type: 'text', text: replyText }, conversationId }
4. On Respond.io success:
   UPDATE moderation_items SET status='replied', final_reply=replyText WHERE id=moderationItemId
5. Return 200
```

### Files to create / edit

| File | Change |
|------|--------|
| `app/api/moderation/reply/route.ts` | Create |
| `app/(app)/moderation/page.tsx` | Wire "Send" button to this route instead of direct `useUpdateModerationItem()` |

---

## Phase 5 — Platform Limitation Warning

**Instagram public comment replies are blocked by Instagram's API. Show this clearly.**

### UI change

When `item.platform === 'instagram'` and the comment type is a public comment (not a DM):

- Show an info banner in the moderation card: "Instagram public comment replies are not supported. You can reply via DM instead."
- Disable the "Send" button
- Keep "Escalate" and "Ignore" available

### How to detect public comment vs DM

Add a `comment_type` field to `moderation_items`:

```sql
ALTER TABLE moderation_items ADD COLUMN comment_type text DEFAULT 'comment'
  CHECK (comment_type IN ('comment', 'dm'));
```

In the webhook handler, detect from `message.channel`:
- `instagram_comment` → `comment_type = 'comment'`
- `instagram_dm` → `comment_type = 'dm'`

### Files to edit

| File | Change |
|------|--------|
| `lib/types.ts` | Add `comment_type?: 'comment' \| 'dm'` to `ModerationItem` |
| `lib/hooks/use-moderation.ts` | Include `comment_type` in `mapItem()` |
| `app/(app)/moderation/page.tsx` | Add platform limitation warning |
| Supabase SQL editor | `ALTER TABLE moderation_items ADD COLUMN comment_type` |

---

## Build Order

```
Phase 1a  SQL: ALTER TABLE moderation_items ADD COLUMN respond_io_conversation_id
Phase 1b  Create /api/webhooks/respond-io/route.ts
Phase 1c  Test webhook with Respond.io test event

Phase 2a  Add Realtime subscription to useModerationItems()

Phase 3   No changes needed — wait for AI_AGENT_SYSTEM_PLAN Phase 1

Phase 4a  Create /api/moderation/reply/route.ts
Phase 4b  Wire "Send" button in moderation page to this route

Phase 5a  SQL: ALTER TABLE moderation_items ADD COLUMN comment_type
Phase 5b  Update mapItem() + ModerationItem type
Phase 5c  Add warning UI in moderation card
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `app/api/webhooks/respond-io/route.ts` | 1 | Create |
| `lib/hooks/use-moderation.ts` | 2 | Edit |
| `app/api/moderation/reply/route.ts` | 4 | Create |
| `app/(app)/moderation/page.tsx` | 4, 5 | Edit |
| `lib/types.ts` | 5 | Edit |
| Supabase SQL editor | 1, 5 | SQL |

---

## Scope Boundary

- **No Google Reviews** — Respond.io does not support it. Not built.
- **No bulk reply** — one reply at a time.
- **No sentiment analysis** — not in scope.
- **No auto-reply rules** — all replies are human-reviewed.
- **No comment hiding/deleting** — Respond.io does not expose this API.
