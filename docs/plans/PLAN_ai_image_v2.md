# PLAN: AI Image Generation v2 — Prompt-First, Single-Flow Redesign

## Problem with Current Design

The current page has two separate tabs:
- **Generate** — write a prompt, pick settings, call Gemini
- **Text on Visuals (TOV)** — manually enter text elements, roles, brand colors, click "Apply AI Design"

This is two-step, two-brain UX. The user has to mentally split "what the image should look like" from "what text I want on it". That's not how creatives think — they describe the whole visual in one pass: *"A luxury skincare product on marble, headline says GLOW, tagline says Redefine Radiance"*.

Additionally, the current prompt goes straight to Gemini with no refinement. A raw user prompt produces mediocre output. A prompt-engineered version of the same intent produces significantly better images.

---

## New Design: Single Prompt, Three-Phase Pipeline

### User Experience

1. User writes **one natural-language prompt** describing the full creative vision, including any text they want on the image.
   - Example: *"A luxury skincare serum bottle on a dark marble surface, morning light, with the headline 'NOVAX GLOW' and tagline 'Redefine Radiance'"*
   - Example: *"Bold lifestyle shot of a woman running at sunrise, add a callout 'LIMITED DROP' in the corner"*
   - Example: *"Clean product shot on white, no text"* — text extraction returns empty, image only

2. User picks: model, style, aspect ratio (+ optional reference image, optional negative prompt)

3. User clicks **Generate**

4. System runs three phases automatically, showing progress:
   - **Phase 1** — "Refining prompt…" (Gemini text, ~2s)
   - **Phase 2** — "Generating image…" (selected image model, ~10–20s)
   - **Phase 3** — "Placing text…" (only if text was found, Gemini vision, ~3s)

5. Canvas shows the final result with text layers already placed. User can then drag, edit, tweak styling.

---

## Architecture Changes

### New API Route: `/api/ai-image/refine-prompt`

**Purpose:** Takes the raw user prompt → returns an enhanced visual generation prompt (no text) + extracted text elements.

**Input:**
```typescript
{
  prompt: string       // raw user input
  style: string        // photorealistic | cinematic | product | lifestyle | illustration | abstract
  aspectRatio: string  // 1:1 | 9:16 | 16:9 | 4:5 | 3:4
}
```

**Output:**
```typescript
{
  imagePrompt: string        // enhanced visual-only prompt, ready for image generation
  refinedPromptDisplay: string  // human-readable version shown in UI as a "refinement badge"
  textElements: {
    text: string
    role: 'headline' | 'tagline' | 'body' | 'callout'
  }[]                        // may be empty [] if user wrote no text intent
}
```

**How it works (Gemini 2.5 Flash text, JSON mode):**

The system prompt instructs Gemini to act as a professional creative director / prompt engineer with two tasks:

1. **Extract text elements** — identify any copy/text overlay requests in the prompt. Instructions: extract exact quoted text or inferred text; assign role (headline = primary big text, tagline = secondary line, callout = short bold accent like "SHOP NOW", body = supporting small text); remove these text requests from the visual prompt entirely (Gemini image models render text poorly — we handle text as overlays).

2. **Enhance the visual prompt** — take the non-text portion of the prompt and add:
   - Professional photography / art direction terminology matched to the chosen `style`
   - Lighting direction (golden hour, soft box, chiaroscuro, flat lay, etc.)
   - Composition guidance (rule of thirds, negative space, depth layers)
   - Mood and atmosphere descriptors
   - Camera/lens language for photorealistic/cinematic styles
   - "No text, no typography, no words, no letters" instruction appended (critical — prevents model from trying to render text itself)
   - Aspect ratio composition hint (e.g., 9:16 → "vertical composition, subject centered, ample negative space at top and bottom")

**Model:** `gemini-2.0-flash` (text only, fast, cheap — this is a lightweight step)

---

### Update: `/api/ai-image/text-placement`

Add `aspectRatio` parameter to the request body. Use it in the system prompt to calibrate font sizes:

| Aspect Ratio | Font scaling notes |
|---|---|
| `9:16` (Story) | Tighter composition, headline 36–64px, conservative margins |
| `16:9` (Landscape) | Wide canvas, can accommodate larger text, horizontal spread |
| `1:1` (Square) | Balanced; headline 48–72px |
| `4:5` / `3:4` (Portrait) | Similar to 9:16 but less extreme; headline 40–70px |

Also add the aspect ratio context to the system prompt so placement coordinates account for the actual canvas shape.

---

### No Changes Needed: `/api/ai-image/generate`

The generate route is already solid. It receives `imagePrompt` (now enhanced by the refine step) and handles both Gemini and Imagen models. No structural changes needed.

---

### Page Rewrite: `app/(app)/ai-image/page.tsx`

#### State removed
- `activeTab` — tab system gone
- `tovItems` — replaced by `extractedTextElements` (auto-populated from refine phase)
- `applyingDesign` — merged into main `generating` flow
- `tovError` — replaced by `phaseError` with phase context

#### State added
- `phase: 'idle' | 'refining' | 'generating' | 'placing' | 'done'` — drives loading UI
- `refinedPromptDisplay: string | null` — shown as a collapsible "How we enhanced your prompt" badge after generation
- `extractedTextElements: { text: string; role: string }[]` — populated by refine step, used in place step

#### Generation flow (single `handleGenerate` function)

```
handleGenerate()
  → setPhase('refining')
  → POST /api/ai-image/refine-prompt { prompt, style, aspectRatio }
  → { imagePrompt, refinedPromptDisplay, textElements }
  
  → setPhase('generating')
  → POST /api/ai-image/generate { prompt: imagePrompt, style, aspectRatio, negativePrompt, model, referenceImage? }
  → { imageData, mimeType }
  
  → if textElements.length > 0:
      setPhase('placing')
      POST /api/ai-image/text-placement { imageData, mimeType, textItems: textElements, aspectRatio }
      → { layers }
      → setTextLayers(layers)
  
  → setPhase('done')
```

#### Phase indicators in canvas (replaces simple spinner)

```
Phase: refining  → "Analyzing your creative brief…"   (small pulse animation)
Phase: generating → "Generating with [Model Name]…"   (existing spin)
Phase: placing    → "Placing text with AI design…"    (small pulse)
```

#### Left panel layout (no tabs)

```
┌─────────────────────────────┐
│  AI Image Generation         │
├─────────────────────────────┤
│  [Reference Image upload]    │
├─────────────────────────────┤
│  Prompt                      │
│  ┌──────────────────────┐   │
│  │ Textarea (5 rows)    │   │
│  │ Describe your visual │   │
│  │ Include any text...  │   │
│  └──────────────────────┘   │
│  + Negative prompt (toggle)  │
├─────────────────────────────┤
│  Model (radio list)          │
├─────────────────────────────┤
│  Style (2-col grid)          │
├─────────────────────────────┤
│  Aspect Ratio (visual pills) │
├─────────────────────────────┤
│  [Generate Image] button     │
└─────────────────────────────┘
```

Placeholder text in the textarea:
```
A luxury skincare serum on dark marble, morning light, golden hour…
Include text? Write it naturally: "add headline 'GLOW', tagline 'Redefine Radiance'"
```

#### Refined prompt badge (appears after generation)

Below the canvas (or collapsible above action bar), show a small "Enhanced prompt" chip:

```
[Sparkles icon] Prompt enhanced by AI  [v show]
```

Expanded:
```
Original: "luxury skincare on marble, headline GLOW"
Enhanced: "luxury skincare serum bottle on polished dark Carrara marble surface,
           golden hour backlight, soft diffused shadows, commercial product
           photography, Canon 85mm f/1.4, shallow depth of field, no text..."
Text found: GLOW (headline), Redefine Radiance (tagline)
```

This is educational — shows users what prompt engineering does, trains them to write better prompts.

#### Text layers panel (unchanged behavior, visible when layers exist)

- Same `DraggableText` component
- Same `TextControls` panel (appears when a layer is selected)
- Same layer chips at bottom
- "Add Text Layer Manually" button moves to the action bar (visible when image exists)

#### Action bar (below canvas, when image exists)

```
[+ Add Text]  [Remove Layer*]        [Regenerate]  [Download PNG]
                                     (* only when a layer is selected)
```

Remove the "Add Text" button's behavior of switching tabs — it now just calls `addTextLayer()` directly.

---

## File Change Summary

| File | Change Type | Notes |
|---|---|---|
| `app/api/ai-image/refine-prompt/route.ts` | **New** | Prompt analysis + enhancement |
| `app/api/ai-image/text-placement/route.ts` | **Update** | Add `aspectRatio` param + font scaling |
| `app/(app)/ai-image/page.tsx` | **Rewrite** | Remove tabs, single flow, phase states |
| `app/api/ai-image/generate/route.ts` | **No change** | Already solid |

---

## Implementation Steps (in order)

### Step 1 — Create `/api/ai-image/refine-prompt/route.ts`

Key implementation details:

- Use `gemini-2.0-flash` via `generateContent` endpoint (text only, no image)
- Set `generationConfig: { responseMimeType: 'application/json' }` for reliable JSON output
- System prompt in a `system_instruction` block (Gemini supports this)
- Temperature: 0.3 (some creativity but mostly deterministic)
- If Gemini returns empty `textElements`, that's valid — image-only output
- Handle parsing failures gracefully: if JSON parse fails, return the original prompt as `imagePrompt` with empty `textElements` so generation still proceeds

**Gemini system instruction outline:**
```
You are a professional creative director and AI image prompt engineer.

TASK 1 — TEXT EXTRACTION:
Identify any copy or text overlay requests in the user's prompt.
These include quoted text, explicit "add text", "with headline", "write", "label", "title", etc.
Extract each as: { text: "exact copy", role: "headline|tagline|body|callout" }
Role assignment:
- headline: primary/main text, largest, brand name or main message
- tagline: secondary line, subtitle, supporting phrase
- callout: short punchy accent ("SHOP NOW", "LIMITED DROP", "NEW")
- body: longer supporting copy, description

TASK 2 — VISUAL PROMPT ENHANCEMENT:
Remove all text overlay requests from the prompt (we handle those as overlays).
Then enhance the remaining visual description with:
- Professional [STYLE] photography direction
- Lighting (based on mood and style)
- Composition language (rule of thirds, negative space, layering)
- Camera/lens details for photorealistic/cinematic styles
- "Compose in [ASPECT_RATIO] orientation" guidance
- End with: "no text, no typography, no words, no letters, no writing"

Return ONLY valid JSON (no markdown):
{
  "imagePrompt": "...",
  "refinedPromptDisplay": "short human-readable summary of what was enhanced",
  "textElements": [...]
}
```

---

### Step 2 — Update `/api/ai-image/text-placement/route.ts`

Add to request body: `aspectRatio?: string`

Add to system prompt (after existing placement rules):

```
ASPECT RATIO CONTEXT — ${aspectRatio}:
${aspectRatio === '9:16' ? 'Vertical Story format. Canvas is taller than wide. Safe zones: top 8% and bottom 8% are clipped by UI — keep y between 8 and 88. Prefer vertical stack layouts. Text in upper third or lower third.' : ''}
${aspectRatio === '16:9' ? 'Horizontal Landscape. Wide canvas. Headline can sit left-aligned with subject on right, or right-aligned with subject on left. Comfortable horizontal negative space.' : ''}
${aspectRatio === '1:1' ? 'Square. Balanced. Rule-of-thirds grid applies symmetrically. Headline works well in lower-left or upper quadrant.' : ''}
${aspectRatio === '4:5' || aspectRatio === '3:4' ? 'Portrait. Slightly taller than wide. Good for editorial single-column text layouts. Lower third is a strong zone.' : ''}
```

Font size scaling by aspect ratio:
- `9:16` — headline: 36–56px, tagline: 20–30px
- `1:1` — headline: 48–72px, tagline: 24–36px
- `16:9` — headline: 52–80px, tagline: 28–40px
- `4:5`/`3:4` — headline: 42–64px, tagline: 22–32px

---

### Step 3 — Rewrite `app/(app)/ai-image/page.tsx`

Key implementation notes:

1. **`handleGenerate` is async and orchestrates all three phases** — single function, no separate `handleApplyDesign`.

2. **Phase state drives UI** — a `phase` enum controls what's shown in the canvas area and what the button says. No separate boolean flags for each loading state.

3. **Error handling** — if refine fails, fall back to using the raw prompt directly (generation still proceeds). If text placement fails, show the image without text layers (non-fatal). Only abort entirely if the image generation itself fails.

4. **The refined prompt badge** — shown below the action bar after generation. Collapsible with a `ChevronDown`. Slate background, monospace text for the prompt content.

5. **"Add Text Manually" button** — in the action bar, calls `addTextLayer()` directly. No tab switching.

6. **Remove from imports:** `Layers`, `AlignLeft`, `AlignCenter`, `AlignRight` (these stay, used in TextControls). Remove: nothing essential is removed from imports since TextControls and DraggableText are kept.

7. **TOVItem type removed** — no longer needed. `TextLayer` and its interfaces remain unchanged.

8. **Textarea placeholder** updated to hint at the new single-prompt approach.

9. **Keep all canvas logic unchanged** — `DraggableText`, `TextControls`, download, layer chips are all untouched.

---

## Edge Cases

| Case | Handling |
|---|---|
| User writes prompt with no text intent | Refine returns `textElements: []`; Phase 3 skipped; image only |
| User writes only text, no visual | Refine enhances with generic visual; text extracted |
| Refine API fails (network / quota) | Fall back to raw prompt for generation; log warning; proceed |
| Text placement fails | Show image without text; show non-fatal warning; user can add text manually |
| User includes Arabic text in prompt | Refine extracts it correctly; placement uses same Unicode-safe text |
| Very long prompt | Refine summarises and structures; not truncated |
| Prompt in Arabic only | Refine prompt instruction is in English but handles Arabic content correctly |

---

## What is NOT Changing

- The `DraggableText` component (keep as-is)
- The `TextControls` component (keep as-is)
- The download/export logic (keep as-is)
- The `MODELS`, `STYLES`, `ASPECT_RATIOS`, `FONTS` constants (keep as-is)
- The `/api/ai-image/generate` route (keep as-is)
- Model badges, pricing tags in UI (keep as-is)
- Reference image upload (keep as-is)
- Negative prompt collapsible (keep as-is)

---

## Estimated Effort

| Step | Files | Effort |
|---|---|---|
| Step 1: refine-prompt route | 1 new file | ~60 lines |
| Step 2: text-placement update | 1 edit | ~15 lines changed |
| Step 3: page rewrite | 1 rewrite | ~400 lines (down from ~987, removing tab logic) |
| **Total** | **3 files** | **~2–3 hours** |
