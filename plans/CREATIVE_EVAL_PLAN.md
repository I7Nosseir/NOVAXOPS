# Creative Evaluation — Action Plan

> **Goal:** Wire the upload → Claude vision analysis → scoring display pipeline. Add result persistence so past evaluations are stored per client. Build an evaluation history view.

---

## Current State Audit

### What exists
| Piece | Status |
|-------|--------|
| Upload UI (drag-drop + click, PNG/JPG/MP4) | Done |
| Client selector | Done |
| Scoring display UI (7-dimension bars, virality ring, all result sections) | Done — fully built, expects specific JSON shape |
| "Evaluate" button | Done — calls `/api/ai` with `agent_type = 'creative_eval'` |

### What is missing
| Piece | Status |
|-------|--------|
| `/api/ai` route with `creative_eval` agent | Does not exist (AI_AGENT_SYSTEM_PLAN) |
| Result persistence | Not built — results disappear on reload |
| Evaluation history per client | Not built |
| Video evaluation (only image currently handled in prompt design) | Partial |

### Expected response JSON (what the UI reads)

```json
{
  "overallScore": 82,
  "viralityScore": 74,
  "engagementPrediction": "high",
  "dimensions": [
    { "name": "Thumb-Stop Rate", "score": 85, "description": "Strong visual contrast..." },
    { "name": "Emotional Resonance", "score": 78, "description": "..." },
    { "name": "Brand Coherence", "score": 90, "description": "..." },
    { "name": "Message Clarity", "score": 80, "description": "..." },
    { "name": "Visual Quality", "score": 88, "description": "..." },
    { "name": "Share & Save Potential", "score": 65, "description": "..." },
    { "name": "Platform Fit", "score": 82, "description": "..." }
  ],
  "psychologicalTriggers": ["Social proof", "FOMO", "Aspiration"],
  "viralElements": ["Strong hook in first 1s", "Relatable scenario"],
  "missingForVirality": ["No clear CTA", "Caption too long"],
  "strengths": ["Excellent color story", "On-brand typography", "Scroll-stopping thumbnail"],
  "improvements": ["Add text overlay for sound-off viewing", "Tighten caption to 50 words"],
  "bestPlatforms": ["instagram", "tiktok"],
  "abTestSuggestion": "Test a version with a direct question as the opening hook vs current statement"
}
```

---

## Phase 1 — Wire the Evaluation (depends on AI_AGENT_SYSTEM_PLAN)

**The UI already sends the correct payload. Just needs `/api/ai` to exist.**

### What the page sends

```ts
fetch('/api/ai', {
  method: 'POST',
  body: JSON.stringify({
    agent: 'creative_eval',
    client: { id, name, brand_identity },
    imageBase64: 'data:image/jpeg;base64,...',
    mediaType: 'image/jpeg',
  })
})
```

### What `/api/ai` must do for this agent

In the route handler (AI_AGENT_SYSTEM_PLAN Phase 1), the `creative_eval` case must pass the image as a vision input to Claude:

```ts
// In prompt-builder.ts, creative_eval case:
const message = await anthropic.messages.create({
  model: AI_MODELS.primary,
  max_tokens: 2048,
  system: systemPrompt,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: context.mediaType,  // 'image/jpeg' | 'image/png'
          data: context.imageBase64.replace(/^data:[^;]+;base64,/, ''),
        },
      },
      { type: 'text', text: userPrompt },
    ],
  }],
})
```

**Note:** Video files cannot be passed to Claude as vision input. For video, extract the first frame client-side (using `HTMLVideoElement.currentTime = 0` + `canvas.getContext('2d').drawImage(video, ...)`) and send that as the image.

### Files to edit

| File | Change |
|------|--------|
| `lib/agents/prompt-builder.ts` | Handle image content array for `creative_eval` agent |
| `app/(app)/creative-eval/page.tsx` | Add video → first-frame extraction before sending |

---

## Phase 2 — Result Persistence

**Store evaluation results so they survive page refresh and build a history.**

### New table

```sql
CREATE TABLE creative_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id),
  asset_url text,               -- Supabase Storage path of the evaluated file
  overall_score integer,
  virality_score integer,
  engagement_prediction text,
  result_json jsonb,            -- full response from Claude
  created_at timestamptz DEFAULT now()
);

ALTER TABLE creative_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_eval" ON creative_evaluations USING (auth.role() = 'authenticated');
```

### New hooks

**File to create:** `lib/hooks/use-evaluations.ts`

```ts
export function useEvaluations(clientId?: string)
  // SELECT * FROM creative_evaluations ORDER BY created_at DESC

export function useCreateEvaluation()
  // INSERT into creative_evaluations
```

### Save flow

After the evaluation result is returned from `/api/ai`:

1. Upload the evaluated file to Supabase Storage (`uploads/evaluations/{clientId}/{timestamp}_{filename}`).
2. INSERT into `creative_evaluations` with `result_json = result`, `asset_url`, `overall_score`, etc.
3. The history list now shows this evaluation.

---

## Phase 3 — Evaluation History

**A list of past evaluations per client, accessible on the creative eval page.**

### UI

Add a collapsible "Past Evaluations" section below the upload area (or a second tab):

| Column | Content |
|--------|---------|
| Thumbnail | Asset thumbnail from `asset_url` |
| Score | `overall_score` / 100 with color ring |
| Virality | `virality_score` |
| Prediction | `engagement_prediction` badge |
| Date | `created_at` formatted |
| Actions | "View results" (reopens the full scoring display for that result) |

Clicking "View results" loads the stored `result_json` and renders the same scoring UI without re-calling Claude.

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/creative-eval/page.tsx` | Add history section, load from `useEvaluations()` |

---

## Phase 4 — Video Support

**Video files need special handling before sending to Claude.**

### Client-side first-frame extraction

```ts
function extractFirstFrame(videoFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoFile)
    video.src = url
    video.currentTime = 0.1
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    video.onerror = reject
  })
}
```

Then send the extracted frame as `imageBase64` with `mediaType: 'image/jpeg'`.

In the AI prompt, note that this is a video (so Claude considers motion, hook, and sequential storytelling in its analysis).

### Files to edit

| File | Change |
|------|--------|
| `app/(app)/creative-eval/page.tsx` | Add `extractFirstFrame()` for MP4 uploads |

---

## Build Order

```
Phase 1a  Ensure /api/ai route exists (AI_AGENT_SYSTEM_PLAN Phase 1)
Phase 1b  creative_eval prompt in prompt-builder.ts (AI_AGENT_SYSTEM_PLAN Phase 3d)
Phase 1c  Handle vision content array in route for image uploads
Phase 1d  Add video first-frame extraction in creative-eval page
Phase 1e  Test end-to-end: upload image → get scoring result

Phase 2a  SQL: CREATE TABLE creative_evaluations
Phase 2b  Create lib/hooks/use-evaluations.ts
Phase 2c  Upload file to Storage after evaluation
Phase 2d  INSERT evaluation result to DB on success

Phase 3a  Add history section UI to creative-eval page
Phase 3b  "View results" to reload stored result_json
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `lib/agents/prompt-builder.ts` | 1 | Edit |
| `app/(app)/creative-eval/page.tsx` | 1, 3, 4 | Edit |
| `lib/hooks/use-evaluations.ts` | 2 | Create |
| Supabase SQL editor | 2 | SQL |

---

## Scope Boundary

- **No batch evaluation** — one file at a time.
- **No comparison mode** — can't compare two assets side by side.
- **No AI video analysis** (actual video content) — Claude vision only supports images. First frame only.
- **No sharing evaluation results** — internal tool only.
