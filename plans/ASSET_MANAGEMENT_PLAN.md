# Asset Management — Action Plan

> **Goal:** Build client file uploads to Supabase Storage, complete the Google Drive browser and import flow, and make the asset library read/write from the DB. Freepik removed — replaced by Google Drive.

## Status Overview

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Asset library from DB | **DONE** | `useAssets()` reads from Supabase `assets` table |
| Phase 2 — Google Drive OAuth | **DONE** | All 4 routes built: `/api/drive/auth`, `/api/drive/callback`, `/api/drive/files`, `/api/drive/disconnect` |
| Phase 3 — Drive browser UI | **DONE** | Assets page tab with folder navigation, search, breadcrumb |
| Phase 4 — Import from Drive | **DONE** | `/api/assets/import-from-drive` downloads file → Supabase Storage → assets table |
| Phase 5 — Client file upload | PENDING | No upload button wired to Supabase Storage |

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| Asset library tab UI | Done — displays asset cards |
| Freepik search tab UI | Done — search input + results grid |
| `useAssets()` hook | Done — reads from `assets` table in Supabase |
| Google Drive tab UI (in library page) | Done — folder browser, search, breadcrumbs |
| `asset_finder` agent UI | Done — button in task detail panel |

### What is missing
| Piece | Status |
|-------|--------|
| `useCreateAsset()` hook | Does not exist |
| `/api/assets/freepik` route | Does not exist — page calls `/api/pinterest` (wrong!) |
| Real Freepik API call | Not built |
| "Save to Library" action (Freepik → Storage → DB) | Not built |
| File upload to Supabase Storage | Not built |
| Google Drive OAuth flow | Stubs only — `/api/drive/auth`, `/api/drive/files` don't exist |
| `FREEPIK_API_KEY` env var | Defined in CLAUDE.md but not in any API call |

### Bug: wrong endpoint in assets page

The assets page currently calls `/api/pinterest` for Freepik search results. This is incorrect. The correct endpoint to build is `/api/assets/freepik`.

---

## Phase 1 — Asset Library (Read from DB)

**The hook exists. The DB table exists. Just make sure the UI reads real data.**

### What to verify

1. `useAssets()` queries `assets` table — already done.
2. `assets` table bucket `assets` exists in Supabase Storage — verify in Supabase dashboard.
3. `mapAsset()` in `use-assets.ts` maps all columns correctly.

No code changes needed if the table and bucket exist. The library tab will show real assets once any are saved.

---

## Phase 2 — Freepik API Integration

**File to create:** `app/api/assets/freepik/route.ts`

### Freepik API

Freepik uses a REST API with an API key:

```
GET https://api.freepik.com/v1/resources
Headers: X-Freepik-API-Key: {FREEPIK_API_KEY}
Query params: ?term={query}&page=1&limit=20&order=relevance&type=photo|vector
```

Response:
```json
{
  "data": [
    {
      "id": 123456,
      "title": "Beautiful sunset photo",
      "description": "...",
      "image": { "source": { "url": "https://..." } },
      "type": "photo",
      "premium": true
    }
  ]
}
```

### Route

```ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  const type = req.nextUrl.searchParams.get('type') ?? 'photo'
  const page = req.nextUrl.searchParams.get('page') ?? '1'

  const res = await fetch(
    `https://api.freepik.com/v1/resources?term=${encodeURIComponent(query!)}&page=${page}&limit=20&type=${type}`,
    { headers: { 'X-Freepik-API-Key': process.env.FREEPIK_API_KEY! } }
  )

  const data = await res.json()
  return NextResponse.json(data)
}
```

### Fix the bug in assets page

**File:** `app/(app)/assets/page.tsx`

Change every `/api/pinterest` fetch call to `/api/assets/freepik`.

### Files to create / edit

| File | Change |
|------|--------|
| `app/api/assets/freepik/route.ts` | Create |
| `app/(app)/assets/page.tsx` | Fix endpoint URL + update response field mapping |
| `.env.local` | Add `FREEPIK_API_KEY=` |

---

## Phase 3 — Save to Library (Freepik → Storage → DB)

**When user clicks "Save" on a Freepik result, download it and store it.**

### Flow

```
1. User clicks "Save" on a Freepik result
2. POST /api/assets/save-from-freepik
   Body: { freepikId, imageUrl, title, license, clientId }
3. Route:
   a. Fetch image from Freepik URL (server-side, bypasses CORS)
   b. Upload to Supabase Storage: assets/{clientId}/{freepikId}.jpg
   c. Get public URL
   d. INSERT into assets table
4. Return { asset }
5. useCreateAsset() invalidates ['assets'] query
```

### New hook: `useCreateAsset()`

**File:** `lib/hooks/use-assets.ts`

```ts
export function useCreateAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Asset, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('assets')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}
```

### API route

**File to create:** `app/api/assets/save-from-freepik/route.ts`

```ts
export async function POST(req: NextRequest) {
  const { freepikId, imageUrl, title, license, clientId } = await req.json()

  // Download image
  const imageRes = await fetch(imageUrl)
  const buffer = await imageRes.arrayBuffer()

  // Upload to Storage
  const path = `${clientId}/${freepikId}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(path, Buffer.from(buffer), { contentType: 'image/jpeg', upsert: true })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path)

  // Insert DB record
  const { data, error } = await supabase.from('assets').insert({
    client_id: clientId,
    title,
    type: 'image',
    source: 'freepik',
    license,
    file_url: publicUrl,
    thumbnail_url: publicUrl,
    created_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asset: data })
}
```

---

## Phase 4 — Client File Upload

**Allow team members to upload their own assets (logos, brand images, client-provided media).**

### Flow

1. "Upload" button in asset library tab → file input (PNG, JPG, MP4, PDF, max 50MB).
2. File → `supabase.storage.from('assets').upload(path, file)`.
3. On success → INSERT into `assets` with `source: 'uploaded'`, `license: 'client_owned'`.

### Implementation

Add directly in `assets/page.tsx` — no separate route needed (client-side upload to Storage is sufficient):

```ts
async function handleUpload(file: File, clientId: string) {
  const path = `${clientId}/uploaded/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('assets').upload(path, file)
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path)
  await createAsset.mutateAsync({
    client_id: clientId,
    title: file.name,
    type: file.type.startsWith('video') ? 'video' : 'image',
    source: 'uploaded',
    license: 'client_owned',
    file_url: publicUrl,
    thumbnail_url: publicUrl,
  })
}
```

---

## Phase 5 — Google Drive OAuth

**File:** `lib/hooks/use-assets.ts` + new API routes

### Current state

The Drive tab in the library page (`app/(app)/library/page.tsx`) has:
- "Connect Drive" button that calls `/api/drive/auth`
- A file browser that calls `/api/drive/files?folderId=...`
- "Disconnect" that calls `/api/drive/disconnect`

None of these routes exist.

### Setup

1. Create a Google Cloud project
2. Enable Google Drive API
3. Create OAuth 2.0 credentials (web application)
4. Add redirect URI: `{domain}/api/drive/callback`
5. Add env vars:
   ```
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/drive/callback
   ```

### Routes to create

**`app/api/drive/auth/route.ts`** — Initiate OAuth:
```
GET /api/drive/auth
→ Redirect to Google OAuth consent screen
  scope: https://www.googleapis.com/auth/drive.readonly
  redirect_uri: /api/drive/callback
  state: {userId}  (to associate token on callback)
```

**`app/api/drive/callback/route.ts`** — Handle callback:
```
GET /api/drive/callback?code=...&state={userId}
1. Exchange code for access_token + refresh_token via Google OAuth2
2. Store encrypted tokens in integrations table:
   { provider: 'google_drive', user_id: state, credentials: { access_token, refresh_token, expires_at } }
3. Redirect to /library?tab=drive
```

**`app/api/drive/files/route.ts`** — List files:
```
GET /api/drive/files?folderId=root&q=searchTerm
1. Read user's token from integrations table
2. Refresh token if expired
3. Call Google Drive API:
   GET https://www.googleapis.com/drive/v3/files
   ?q="folderId" in parents AND mimeType contains "image/"
   &fields=id,name,mimeType,thumbnailLink,webViewLink,size
4. Return file list
```

**`app/api/drive/disconnect/route.ts`** — Revoke:
```
POST /api/drive/disconnect
1. Revoke token via Google OAuth revoke endpoint
2. DELETE from integrations WHERE provider = 'google_drive' AND user_id = current
3. Return 200
```

### Files to create

| File | Purpose |
|------|---------|
| `app/api/drive/auth/route.ts` | Start OAuth |
| `app/api/drive/callback/route.ts` | OAuth callback |
| `app/api/drive/files/route.ts` | List Drive files |
| `app/api/drive/disconnect/route.ts` | Revoke access |

---

## Phase 6 — Import from Drive to Library

**"Import to Library" button on Drive file → downloads file → saves to Supabase Storage → inserts asset record.**

```ts
// POST /api/assets/import-from-drive
// Body: { driveFileId, fileName, mimeType, clientId }

// 1. Download file content via Drive API (using user's token)
// 2. Upload to Supabase Storage
// 3. Insert asset record with source: 'drive'
```

---

## Build Order

```
Phase 1   Verify assets table + Storage bucket exist in Supabase

Phase 2a  Create /api/assets/freepik/route.ts
Phase 2b  Fix /api/pinterest → /api/assets/freepik in assets/page.tsx
Phase 2c  Update response field mapping for Freepik API response shape

Phase 3a  Add useCreateAsset() to use-assets.ts
Phase 3b  Create /api/assets/save-from-freepik/route.ts
Phase 3c  Wire "Save" button in Freepik results grid

Phase 4a  Add "Upload" button to asset library tab
Phase 4b  Client-side upload to Supabase Storage
Phase 4c  useCreateAsset() on upload success

Phase 5a  Set up Google Cloud project + OAuth credentials
Phase 5b  Create /api/drive/auth/route.ts
Phase 5c  Create /api/drive/callback/route.ts
Phase 5d  Create /api/drive/files/route.ts
Phase 5e  Create /api/drive/disconnect/route.ts
Phase 5f  Wire Drive tab in library page to real routes

Phase 6   Create /api/assets/import-from-drive/route.ts
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `lib/hooks/use-assets.ts` | 3 | Edit |
| `lib/types.ts` | — | Verify Asset type matches DB |
| `app/(app)/assets/page.tsx` | 2, 3, 4 | Edit |
| `app/(app)/library/page.tsx` | 5 | Edit |
| `app/api/assets/freepik/route.ts` | 2 | Create |
| `app/api/assets/save-from-freepik/route.ts` | 3 | Create |
| `app/api/drive/auth/route.ts` | 5 | Create |
| `app/api/drive/callback/route.ts` | 5 | Create |
| `app/api/drive/files/route.ts` | 5 | Create |
| `app/api/drive/disconnect/route.ts` | 5 | Create |
| `app/api/assets/import-from-drive/route.ts` | 6 | Create |

---

## Scope Boundary

- **No Higgsfield video generation** — planned but separate (not part of asset management).
- **No Flux 2 / Ideogram** — image generation is a separate planned feature.
- **No asset tagging UI** — tags stored in DB but no edit UI yet.
- **No bulk delete** — delete one asset at a time.
- **No asset versioning** — replacing an asset creates a new record.
