# NOVAX Ops — New Features Plan (Round 2)
**Written:** 2026-05-21  
**Source:** Team meeting + designer workflow feedback  
**Scope:** 7 feature additions spanning task management, design workflows, collaboration docs, and AI tooling

---

## Feature Priority Overview

| Priority | Feature | Impact | Effort |
|---|---|---|---|
| P0 | Approval Page — Media Upload | Blocks client approval flow | Low |
| P0 | Tasks Tab + My Tasks Popup | Core workflow gap | Medium |
| P1 | Task Sub-Types & Filtering | Daily friction for designers | Low |
| P1 | Resend Email Notifications | Team coordination | Medium |
| P2 | Client Design Brief Forms | Removes design briefing chaos | Medium |
| P2 | In-App Collaborative Documents | Replaces external sheets | High |
| P3 | AI Smart Image Resize Engine | Designer time saver | High |

---

## Feature 1 — Approval Page: Media Upload (P0)

### Problem
The internal approval page (`/approval`) only captures captions. There is no way to attach the actual content (image, video, carousel) when creating an approval request. The public client-facing portal (`/approval/[token]`) shows media if media_urls are stored — but the compose flow to create requests has no upload UI. Clients are approving text only, which is not viable.

### What gets built

**Internal approval page — compose dialog changes:**
- Add media upload section (same XHR + Supabase Storage pattern used in Publishing)
- Support: single image, single video, carousel (multi-image)
- Preview thumbnail shown after upload
- Media URL stored to `approval_requests.media_urls[]` in DB
- Caption field stays (required), media becomes recommended-but-optional

**Public portal (`/approval/[token]`) already handles media display** — it reads `media_urls` and renders images/video. This part works once the upload side is fixed.

**Also fix:** carousel navigation in the public portal (prev/next arrows on multi-image posts).

### DB change
No schema change needed. `approval_requests` table already has a `media_urls jsonb` column (or add it if missing).

### API change
`POST /api/approval` — accept `media_urls` array alongside caption and client_id.

### Files to touch
```
app/(app)/approval/page.tsx          → add media upload UI to compose dialog
app/approval/[token]/page.tsx        → carousel nav fix
app/api/approval/route.ts            → accept media_urls in POST body
```

---

## Feature 2 — Tasks Tab + My Tasks Floating Button (P0)

### Problem
Tasks are created in the Pipeline board and visible there, but there is no dedicated "My Tasks" view per user. If you're a designer navigating to the publishing page or assets page, you have no idea what tasks you're assigned to without going back to the full pipeline board. New tasks created via the "New Task" button in the header are added to the pipeline but not surfaced per user anywhere.

### What gets built

#### 2a. Tasks Page — `/tasks`

A dedicated task list page, separate from the pipeline Kanban view.

**Filters (top bar):**
- Assigned to: Me / All / specific user (admin/CD only)
- Client: dropdown
- Stage: all pipeline stages
- Priority: Low / Medium / High / Urgent
- Sub-type: (see Feature 3)
- Status: Active / Completed / Overdue

**View modes:**
- List view (default) — grouped by client
- Table view — sortable columns: Title, Client, Stage, Priority, Sub-type, Due Date, Assigned to

**Per task row:**
- Title + client badge
- Stage chip (colored per STAGE_CONFIG)
- Priority dot
- Sub-type badge (e.g., "Motion Graphics")
- Due date (red if overdue)
- Assigned avatar
- Click → opens task detail slide-over (same component as pipeline board)

**Sidebar nav:** Add "Tasks" item between Pipeline and Clients in sidebar nav.

#### 2b. My Tasks Floating Button

A persistent floating button visible on every app page. Positioned bottom-right (above any other FABs).

**Trigger:** Click the floating button → opens a slide-over panel from the right.

**Panel contents:**
- Header: "My Tasks" + count badge
- Tabs: "Active" / "Overdue" / "Completed this week"
- Per task: title, client, stage, priority, sub-type, due date
- Click any task → navigates to pipeline board with that task's detail panel open (or opens detail panel in place)
- Quick status update: dropdown to move stage without leaving the panel
- "View All" link → `/tasks?assignedTo=me`

**Implementation:** Render the FAB in the app layout (`app/(app)/layout.tsx`) so it appears on every page. Use a Zustand store or React context to hold open/close state. Fetch tasks via `GET /api/tasks?assignedTo=me` on mount.

### DB/API additions
```
GET /api/tasks                        → list tasks with filters (assignedTo, client, stage, priority, subtype)
PATCH /api/tasks/[id]/stage           → quick stage update from the float panel
```

### Files to touch
```
app/(app)/tasks/page.tsx              → new page
app/(app)/layout.tsx                  → add MyTasksFloat component
components/tasks/my-tasks-float.tsx   → FAB + slide-over panel
components/layout/sidebar.tsx         → add Tasks nav item
app/api/tasks/route.ts                → GET with filters
app/api/tasks/[id]/stage/route.ts     → PATCH stage
```

---

## Feature 3 — Task Sub-Types & Filtering (P1)

### Problem
A "design" task could be a social media graphic, motion graphics piece, logo animation, banner, presentation slide, or print asset. Currently there's no way to distinguish these. A designer is told "you have a social media task" with no indication of what type of work it actually is, leading to miscommunication and briefing back-and-forth.

### What gets built

#### Sub-type field on tasks

Add a `sub_type` field (text, nullable) to the `tasks` table.

**Sub-types by task type (driven by pipeline stage):**

| Stage/Role | Sub-types |
|---|---|
| Design | Social Graphic, Motion Graphics, Logo / Brand Asset, Story/Reel Frame, Banner/Ad, Presentation Slide, Print Asset |
| Copy | Caption, Script, Blog Post, Email, Ad Copy, Bio/Profile, Hashtag Set |
| Video | Shoot & Edit, Reels Edit, Motion Graphic Video, AI Video (Higgsfield), Slideshow |
| Strategy | Quarterly Plan, Monthly Calendar, Campaign Brief, Competitor Report |
| Research | Trend Report, Audience Study, Competitor Analysis |

Sub-type list is contextual — shown options change based on the task's current pipeline stage.

#### UI changes

**Task creation/edit form:**
- After Stage selector: "Sub-type" dropdown (contextual based on selected stage)
- Optional field — existing tasks won't break

**Task card (pipeline board + tasks page):**
- Show sub-type as a small badge below the title
- Color-coded per category (design = purple, copy = blue, video = orange, strategy = teal)

**Pipeline board filter bar:**
- Add "Sub-type" filter chip (multi-select)
- Add to existing "Tasks" page filters

**Task detail slide-over:**
- Sub-type editable inline

### DB change
```sql
ALTER TABLE tasks ADD COLUMN sub_type text;
```

### Files to touch
```
components/pipeline/task-card.tsx          → sub-type badge
components/tasks/task-detail-panel.tsx     → sub-type field (editable)
app/(app)/pipeline/page.tsx                → sub-type filter
app/(app)/tasks/page.tsx                   → sub-type filter
lib/types.ts                               → add sub_type to Task interface
lib/utils.ts                               → add TASK_SUBTYPES config map
sql/007_task_subtypes.sql                  → ALTER TABLE migration
```

---

## Feature 4 — Resend Email Notifications (P1)

### Problem
No email notifications exist anywhere in the platform. Team members find out about task assignments, approvals, and mentions only if they're actively using the app. Clients receive approval links by copy-paste only. When the agency domain is connected, Resend will be the transactional email provider.

### Architecture

**Provider:** Resend (`npm install resend`)  
**From address:** `noreply@[agency-domain]` (configured via env var `RESEND_FROM_ADDRESS`)  
**Env vars to add:** `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`

**Email templates (React Email components):**

| Template | Trigger | Recipients |
|---|---|---|
| `task-assigned.tsx` | Task assigned to user | Assigned team member |
| `task-stage-change.tsx` | Task moved to new stage | Assigned member + watchers |
| `approval-request.tsx` | Approval request sent to client | Client email on the request |
| `approval-decision.tsx` | Client approves or requests changes | Account manager + assigned member |
| `team-invite.tsx` | Admin invites team member | Invitee |
| `mention.tsx` | @mention in task comment | Mentioned user |

**Notification preferences** (Settings → Notifications tab — currently has toggles but no backend):
- Wire existing toggle UI to `users.notification_preferences jsonb` in Supabase
- Each email type has an on/off toggle per user
- Before sending any email: check the recipient's preference for that type

**Sending pattern:**
- All emails sent server-side inside relevant API routes (not client-side)
- Fire-and-forget: don't block the API response waiting for Resend confirmation
- Log failures to `audit_log`

### Centralized email utility
```
lib/email.ts     → sendEmail(template, to, data) — wraps Resend client, reads RESEND_API_KEY
emails/          → React Email templates directory
  task-assigned.tsx
  approval-request.tsx
  approval-decision.tsx
  team-invite.tsx
```

### Integration points (where to call sendEmail)
```
POST /api/tasks              → task-assigned when assignee set
PATCH /api/tasks/[id]/stage  → task-stage-change
POST /api/approval           → approval-request to client email
PATCH /api/approval          → approval-decision when client submits
POST /api/auth/invite        → already exists, add email send here
```

### Files to add/touch
```
lib/email.ts
emails/task-assigned.tsx
emails/approval-request.tsx
emails/approval-decision.tsx
emails/team-invite.tsx
app/api/tasks/route.ts              → call sendEmail after task create
app/api/approval/route.ts           → call sendEmail after approval create
app/(app)/settings/page.tsx         → wire notification toggle to DB
```

---

## Feature 5 — Client Design Brief Forms (P2)

### Problem
When a client commissions design work, the brief currently lives in free-text task descriptions. Designers have no structured reference — they ask account managers, account managers ask clients, clients send voice notes, and the final brief is scattered across WhatsApp. This causes revisions, rework, and delay.

### What gets built

A **structured design brief form per client**, stored in Supabase and always accessible to designers from the task context.

#### Brief sections and UI

**Section 1 — Content Dimensions** (choice buttons with visual examples)

| Format | Dimensions | Common use |
|---|---|---|
| Story / Reel Cover | 1080 × 1920 (9:16) | Instagram/TikTok stories |
| Feed Square | 1080 × 1080 (1:1) | Instagram feed |
| Feed Portrait | 1080 × 1350 (4:5) | Instagram feed portrait |
| Feed Landscape | 1350 × 1080 (landscape) | Facebook/LinkedIn |
| YouTube Thumbnail | 1280 × 720 (16:9) | YouTube |
| LinkedIn Banner | 1584 × 396 | LinkedIn profile |
| Print A4 | 2480 × 3508 | Printed materials |

Each format shown as a visual card (proportional preview box, name, pixel dimensions). Client/AM clicks to select one or more.

**Section 2 — Content Style**
- Primary style: Minimalist / Bold & Graphic / Photography-led / Illustrated / Typographic
- Color palette usage: Brand colors only / Allow complementary / Flexible
- Text density: Heavy text / Balanced / Visuals-first / Text-free
- Reference uploads: up to 3 example images they like

**Section 3 — AI Video Requirements** (shown if "AI Video" selected as content type)
- Video length: 6s / 15s / 30s / 60s / Custom
- Visual style: Cinematic / Lifestyle / Product showcase / Abstract / Documentary
- Character consistency needed: Yes / No
- Mood board: text description (free input, 2–3 sentences)
- Reference video URL (optional)
- Voice over: Yes / No / Music only

**Section 4 — Motion Graphics Requirements** (shown if "Motion Graphics" selected)
- Animation style: Smooth & Clean / Dynamic & Fast / Subtle / Kinetic Typography / Loop
- Duration: Under 10s / 10–30s / 30–60s
- Has after effects template: Yes / No / Please create new

**Section 5 — Restrictions & Notes**
- Elements to always include: logo / tagline / product / person
- Elements to never show: (free text)
- Font restrictions: brand fonts only / system fonts ok / designer's choice
- Additional notes: (free text)

#### Where briefs live

**Per-client: stored in `clients.design_brief_json` (add column)**

Brief accessible from:
1. Client detail modal → new "Design Brief" tab
2. Task detail slide-over → "Client Brief" collapsible section (reads from the task's client)
3. New Client Wizard → add brief as optional Step 10 or make it a post-wizard edit

#### DB change
```sql
ALTER TABLE clients ADD COLUMN design_brief_json jsonb DEFAULT '{}';
```

#### Files to touch
```
components/clients/design-brief-form.tsx    → new form component
app/(app)/clients/page.tsx                  → add Design Brief tab to client modal
components/tasks/task-detail-panel.tsx      → add Client Brief collapsible
lib/types.ts                                → add design_brief_json to Client interface
sql/008_design_brief.sql                    → ALTER TABLE migration
```

---

## Feature 6 — In-App Collaborative Documents (P2)

### Problem
Agency workflows generate many iterative documents: content strategy decks, competitor analysis tables, monthly reporting summaries, budget trackers, briefing sheets. Currently these are created in Google Sheets or Excel, emailed, revised, re-emailed. Every edit cycle adds friction and version confusion.

### What gets built

A lightweight **in-app document system** — not a full spreadsheet app, but structured enough to replace the most common agency documents with real-time collaboration and direct sharing.

#### Document types

| Type | Template | Primary use |
|---|---|---|
| Content Calendar | 7-column table (Date, Platform, Post type, Caption, Status, Assignee, Notes) | Monthly planning |
| Reporting Summary | KPI table + commentary sections | Monthly/quarterly reports |
| Campaign Brief | Structured brief with sections | Campaign kickoff |
| Budget Tracker | Line-item table with totals | Ad spend + production costs |
| Blank Document | Free-form rich text + tables | Anything else |

#### Core functionality

**Editor:**
- Rich text editing (headings, bold, italic, bullet lists, numbered lists)
- Table editor: add/remove rows and columns, cell editing, auto-totals on number columns
- Inline image embed (from Assets library or direct upload)
- @mention team member → they get notified + added as viewer
- Auto-save every 30 seconds (or on blur)

**Sharing:**
- Share with specific team members (read or edit permission)
- Send by email (triggers a Resend notification with a deep link)
- Generate a read-only share link (no auth required to view) — same pattern as approval portal
- Download as: Excel (`.xlsx` via `ExcelJS`) or PDF (print CSS)

**Document management:**
- `/docs` page — list of all documents the user has access to
- Filter: All / Mine / Shared with me / By client
- Search by title
- Archive (soft-delete)

**Linking to client/project:**
- Each document can be linked to a client or project
- Client detail modal → "Documents" tab shows linked docs

#### Tech stack additions
- `npm install exceljs` — server-side Excel generation (lighter than xlsx, supports formatting)
- `npm install @tiptap/react @tiptap/starter-kit` — rich text editor (Tiptap, MIT licensed, headless, works with Tailwind)
- For table editing: `@tiptap/extension-table` + related table extensions

#### DB schema
```sql
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'blank',            -- content_calendar | reporting | campaign_brief | budget | blank
  content jsonb NOT NULL DEFAULT '{}',            -- Tiptap JSON format
  client_id uuid REFERENCES clients(id),
  project_id uuid REFERENCES projects(id),
  created_by uuid REFERENCES users(id) NOT NULL,
  is_archived boolean DEFAULT false,
  share_token text UNIQUE,                        -- for public read-only link
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE document_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view',        -- view | edit
  added_at timestamptz DEFAULT now(),
  UNIQUE(document_id, user_id)
);
```

#### API routes
```
GET    /api/docs                  → list user's accessible documents
POST   /api/docs                  → create document
GET    /api/docs/[id]             → fetch document content + members
PATCH  /api/docs/[id]             → save content / rename
DELETE /api/docs/[id]             → archive
POST   /api/docs/[id]/share       → add member or generate share link
GET    /api/docs/[id]/export      → Excel or PDF download
GET    /api/docs/public/[token]   → public read-only view (no auth)
```

#### Files to add
```
app/(app)/docs/page.tsx                  → document list
app/(app)/docs/[id]/page.tsx             → document editor
app/docs/public/[token]/page.tsx         → public read-only view
components/docs/doc-editor.tsx           → Tiptap editor wrapper
components/docs/doc-table.tsx            → table editing component
components/docs/doc-share-dialog.tsx     → share + export dialog
components/layout/sidebar.tsx            → add "Documents" nav item
app/api/docs/route.ts
app/api/docs/[id]/route.ts
app/api/docs/[id]/share/route.ts
app/api/docs/[id]/export/route.ts
app/api/docs/public/[token]/route.ts
sql/009_documents.sql
```

---

## Feature 7 — AI Smart Image Resize Engine (P3)

### Overview

The agency constantly needs the same creative adapted across formats: an Instagram feed post becomes a Story, a story becomes a square thumbnail. Currently this is done manually in Photoshop, wasting 15–30 min per asset.

This is a **Type 2: Smart Layout Adaptation** engine — not dumb cropping, and not generative AI image expansion (too complex, too costly per image). The goal is intelligent repositioning of detected elements to fit the target canvas while preserving visual hierarchy, safe zones, and brand rules.

**Input:** 1350 × 1080 px (Instagram landscape / Facebook)  
**Output 1:** 1080 × 1920 px (9:16 — Stories, Reels cover)  
**Output 2:** 1080 × 1080 px (1:1 — Instagram square feed)

### How it works (pipeline)

**Step 1 — Upload**
User uploads the image on the Resize Tool page. Accepted formats: JPG, PNG, WebP. Max size: 10MB.

**Step 2 — Element Detection (Claude Vision)**
Image sent to `POST /api/tools/resize/analyze`:
```
Claude prompt:
"Analyze this image. Identify and return bounding boxes (x, y, width, height as % of total dimensions) for:
- headline / primary text (if any)
- secondary text / sub-headline (if any)
- CTA text or button (if any)
- logo (if any)
- primary subject: person, product, or focal object
- background region (dominant)

Also identify:
- focal point: the single most visually important area (x%, y%) as a percentage of the image
- visual weight distribution: top-heavy / centered / bottom-heavy
- background type: solid color / gradient / complex photo

Return as JSON."
```

Claude returns a layout schema like:
```json
{
  "elements": [
    { "type": "headline", "x": 5, "y": 8, "w": 60, "h": 12 },
    { "type": "logo", "x": 78, "y": 4, "w": 18, "h": 8 },
    { "type": "subject", "x": 30, "y": 25, "w": 45, "h": 70 },
    { "type": "cta", "x": 10, "y": 82, "w": 35, "h": 10 }
  ],
  "focal_point": { "x": 52, "y": 55 },
  "visual_weight": "centered",
  "background_type": "complex_photo"
}
```

**Step 3 — Adaptive Layout Rules**

Server applies format-specific rules to reposition detected regions:

*For 9:16 (1080 × 1920):*
- Safe zones: top 12% (Instagram notch), bottom 22% (Instagram caption area + bottom controls)
- Subject: vertically centered in 13%–78% safe zone, horizontal position preserved
- Headline: moved to top safe zone (14%–22%)
- CTA: moved to lower safe zone (72%–80%)
- Logo: top-right within safe zone (14%, 88%)
- Background: scaled to fill 9:16 canvas — if complex photo, scale from focal point and mirror-fill edges using Sharp

*For 1:1 (1080 × 1080):*
- Subject: centered horizontally, vertically centered in top 75% of canvas
- Headline: above subject (if top-heavy) or below (if bottom-heavy)
- CTA: bottom 15%
- Logo: top-right

**Step 4 — Server-side rendering (Sharp)**

Using Sharp (available via Next.js server runtime):
1. Load original image
2. Extract subject region → composite onto new canvas at calculated position
3. Background handling (one of two approaches based on `background_type`):
   - **Solid / gradient:** extend canvas, fill with detected dominant color
   - **Complex photo:** scale to fill + apply Gaussian blur on the extended regions (looks intentional, commonly used in social media)
4. Composite each text/logo region at new positions
5. Output as JPEG at 90% quality, target DPI 72 (screen)

**Important limitation acknowledged:** Text and elements baked into a flat image cannot be cleanly separated pixel-by-pixel. The repositioning works by copying rectangular regions — if the background behind the text is complex, some visual artifact may appear. Best results come from assets generated in the platform's AI Image Studio (where layer data is stored separately). This limitation is communicated to the user in the UI.

**Step 5 — AI Quality Pass**

A second Claude Vision call evaluates both outputs:
- Text readability: is any text cut off or overlapping?
- Element overlap: do any elements collide?
- Visual balance: does composition feel intentional?
- Safe zone compliance: does any critical element fall in a platform UI-blocked zone?

Returns a confidence score per output (High / Medium / Needs review) + specific notes. User sees these notes alongside the preview.

**Step 6 — Preview + Download**

User sees:
- Original (left)
- 9:16 output (center)  
- 1:1 output (right)
- Confidence badge per output
- "Regenerate" button (re-runs Steps 3–5 with alternate layout strategy)
- Download individual or "Download All (ZIP)"

### API routes
```
POST /api/tools/resize/analyze    → upload + Claude Vision element detection
POST /api/tools/resize/generate   → Sharp composition → returns signed URLs for two outputs
GET  /api/tools/resize/download   → ZIP of both outputs
```

### Page
```
app/(app)/tools/resize/page.tsx   → upload → analyze → preview → download
components/tools/resize-preview.tsx
```

### Tech additions
```
npm install archiver              → ZIP generation for bulk download
Sharp is already available via Next.js image optimization infrastructure
```

### DB (optional, for history)
```sql
CREATE TABLE resize_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES users(id),
  original_url text NOT NULL,
  output_9x16_url text,
  output_1x1_url text,
  layout_schema jsonb,
  quality_scores jsonb,
  created_at timestamptz DEFAULT now()
);
```

### Files to add
```
app/(app)/tools/resize/page.tsx
components/tools/resize-preview.tsx
app/api/tools/resize/analyze/route.ts
app/api/tools/resize/generate/route.ts
app/api/tools/resize/download/route.ts
components/layout/sidebar.tsx              → add "Tools" nav section → Resize
```

---

## Build Order (recommended)

### Week 1 — Fixes & Task Management (highest daily impact)
1. **Approval page media upload** (P0, ~2h) — critical workflow blocker
2. **Task sub-types** (P1, ~3h) — DB migration + UI badge + filter
3. **Tasks page `/tasks`** (P0, ~4h) — list view + filters
4. **My Tasks floating button** (P0, ~3h) — FAB + slide-over

### Week 2 — Notifications & Design Workflow
5. **Resend email setup + templates** (P1, ~4h) — install + task-assigned + approval-request emails
6. **Client Design Brief forms** (P2, ~6h) — form component + client modal tab + task panel

### Week 3 — Documents
7. **In-app documents** (P2, ~10h) — Tiptap editor + DB + API routes + list page

### Week 4 — AI Tools
8. **AI Smart Resize Engine** (P3, ~8h) — Claude Vision analyze + Sharp generate + preview UI

---

## Summary of new env vars needed

```
RESEND_API_KEY=                    # Resend account → API Keys
RESEND_FROM_ADDRESS=               # e.g., noreply@novax.agency
```

## Summary of new npm packages needed

```
resend                             # Email notifications
@tiptap/react                      # Rich text editor
@tiptap/starter-kit                # Tiptap base extensions
@tiptap/extension-table            # Table support
exceljs                            # Excel export
archiver                           # ZIP download for resize tool
```
