# AI Image Creation — Action Plan

> **Goal:** Let the team generate production-ready social media images by combining Imagen 3 (background/visual) with an in-browser canvas editor (editable text layers). Keep it simple: one AI-generated visual + user-controlled text layers + one-click PNG export.

---

## Architecture Decision

**Why text is NOT burned into the AI image:**

AI models (including Imagen 3) produce unreliable text at complex layouts, small sizes, and bilingual (EN/AR) content. Instead:

- **Imagen 3** generates the visual (background, scene, product context) — no text in the prompt
- **Canvas layer** renders text on top as live DOM elements — fully editable, pixel-perfect, supports Arabic RTL
- **Export** flattens canvas + image into a single PNG at the correct resolution

This is the same approach used by Canva, Adobe Express, and every production-grade design tool.

---

## Current State

| Piece | Status |
|-------|--------|
| `GEMINI_API_KEY` env var | Already in stack |
| `@google/generative-ai` SDK | Available (same as AI text routes) |
| Imagen 3 API | Available via same SDK |
| `/ai-image` page | Does not exist |
| Canvas text editor | Does not exist |
| Fabric.js / Konva | Not installed |

---

## Phase 1 — Imagen 3 API Route

**File to create:** `app/api/ai/image/route.ts`

### Imagen 3 via Google Generative AI

Model ID: `imagen-3.0-generate-001`
Pricing: ~$0.03 per image (same GEMINI_API_KEY)

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  const { prompt, aspectRatio, clientName, brandColors } = await req.json()

  const model = genai.getGenerativeModel({ model: 'imagen-3.0-generate-001' })

  const result = await model.generateImages({
    prompt: buildImagePrompt(prompt, clientName, brandColors),
    numberOfImages: 1,
    aspectRatio: aspectRatio ?? '1:1',  // '1:1' | '9:16' | '16:9'
    safetyFilterLevel: 'block_low_and_above',
  })

  const imageBase64 = result.images[0].imageData
  return NextResponse.json({ imageBase64 })
}

function buildImagePrompt(
  userPrompt: string,
  clientName: string,
  brandColors: string[]
): string {
  return [
    userPrompt,
    'No text, no words, no letters, no typography in the image.',
    `Visual style: professional social media content for ${clientName}.`,
    `Brand color palette: ${brandColors.join(', ')}.`,
    'Clean composition with space for text overlay.',
    'High quality, sharp, commercial photography style.',
  ].join(' ')
}
```

### Aspect ratio → canvas size map

| Ratio | Canvas size | Use case |
|-------|------------|---------|
| `1:1` | 1080×1080 | Instagram feed, LinkedIn |
| `9:16` | 1080×1920 | Instagram Story/Reel |
| `16:9` | 1920×1080 | LinkedIn banner, YouTube |
| `4:5` | 1080×1350 | Instagram portrait |

---

## Phase 2 — Canvas Editor Component

**File to create:** `components/image-creator/canvas-editor.tsx`

### Install

```bash
npm install fabric
npm install @types/fabric --save-dev
```

Fabric.js provides a full interactive canvas: draggable objects, text editing, selection handles.

### Canvas structure

```
<CanvasEditor>
  ├── <canvas> (Fabric.js instance)
  │     ├── [0] Background image (Imagen 3 output, locked)
  │     ├── [1..n] Text layers (editable, movable)
  │     └── [n+1] Logo layer (optional, movable)
  └── <Toolbar> (font, size, color, align, bold, effects)
```

### Component props

```ts
interface CanvasEditorProps {
  backgroundBase64: string    // from Imagen 3
  canvasSize: { w: number; h: number }
  initialLayers: TextLayer[]  // from Claude layout spec
  onExport: (dataUrl: string) => void
}

interface TextLayer {
  id: string
  content: string
  font: string             // from BRAND_FONTS list
  size: number
  color: string
  bold: boolean
  align: 'left' | 'center' | 'right'
  x: number                // 0-100% of canvas width
  y: number                // 0-100% of canvas height
  effect?: 'none' | 'shadow' | 'outline' | 'glow'
  language?: 'en' | 'ar'  // ar triggers RTL direction
}
```

### BRAND_FONTS (curated set — no font loading headaches)

```ts
export const BRAND_FONTS = [
  { name: 'Playfair Display', style: 'serif',   use: 'Headlines, luxury brands' },
  { name: 'Inter',            style: 'sans',    use: 'Body, modern brands' },
  { name: 'Montserrat',       style: 'sans',    use: 'Bold headlines' },
  { name: 'Lora',             style: 'serif',   use: 'Elegant, editorial' },
  { name: 'Space Grotesk',    style: 'sans',    use: 'Tech, startup brands' },
  { name: 'Cormorant Garamond', style: 'serif', use: 'High-end, fashion' },
  // Arabic fonts
  { name: 'Noto Kufi Arabic', style: 'arabic',  use: 'Arabic body text' },
  { name: 'Noto Naskh Arabic', style: 'arabic', use: 'Arabic headlines' },
]
```

### Text effects (CSS filter + Fabric shadow)

```ts
export const TEXT_EFFECTS = {
  none:    {},
  shadow:  { shadow: '3px 3px 6px rgba(0,0,0,0.6)' },
  outline: { stroke: '#000000', strokeWidth: 2 },
  glow:    { shadow: '0px 0px 20px rgba(255,255,255,0.9)' },
  'dark-bg': { backgroundColor: 'rgba(0,0,0,0.4)', padding: 8 },
}
```

---

## Phase 3 — Claude Layout Spec

**Claude generates the initial layer spec from the brief.** User edits from there — Claude is just the starting point.

### Prompt to Claude (agent: `image_layout`)

```
You are a social media art director for {clientName}.
Brand colors: {primary_color}, {secondary_colors}.
Tone: {tone_of_voice}.
Available fonts: {BRAND_FONTS names}.
Available effects: none, shadow, outline, glow, dark-bg.

Task: generate a JSON layout spec for this brief:
"{userBrief}"

Canvas: {aspectRatio} ({canvasSize})

Return ONLY this JSON:
{
  "imagePrompt": "...",        // visual description (NO TEXT in image)
  "layers": [
    {
      "id": "headline",
      "content": "...",
      "font": "...",
      "size": 72,
      "color": "#hex",
      "bold": true,
      "align": "center",
      "x": 50,
      "y": 30,
      "effect": "shadow",
      "language": "en"
    }
  ]
}
Max 3 text layers. Keep it clean. Match brand voice.
```

### Add to `/api/ai` route as new agent type: `image_layout`

---

## Phase 4 — AI Image Creation Page

**File to create:** `app/(app)/ai-image/page.tsx`

### UI flow (3 steps)

```
Step 1 — Brief
  [Client selector]
  [Aspect ratio: 1:1 | 9:16 | 16:9 | 4:5]
  [Language: EN | AR | Both]
  [Brief textarea: "Eid sale post, 20% off, luxe cosmetics"]
  [Generate button]

Step 2 — Edit
  Left panel: canvas (Fabric.js)
    - Background image (locked layer)
    - Text layers (click to select, drag to move)
    - Handles to resize/rotate
  Right panel: layer controls
    - Layer list (reorder, delete, add)
    - Selected layer: font, size, color, effect
    - Add text layer button
    - Add logo button (upload)

Step 3 — Export
  [Download PNG] (flattens canvas at full resolution)
  [Save to Library] (saves to Supabase assets table)
  [Add to Publishing] (opens compose dialog pre-filled)
```

### Sidebar nav item to add

Add "AI Image" between "Assets" and "Creative Eval" in the sidebar.

---

## Phase 5 — Export + Save

### Client-side export

```ts
function exportCanvas(canvas: fabric.Canvas, filename: string) {
  const dataUrl = canvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier: 2,   // 2× for retina — 1080px canvas → 2160px export
  })
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}
```

### Save to library

On "Save to Library": upload the PNG to Supabase Storage, INSERT into `assets` table with `source: 'ai_generated'`.

Requires `useCreateAsset()` (also needed by ASSET_MANAGEMENT_PLAN Phase 3 — build once, use everywhere).

---

## Build Order

```
Phase 1a  Create app/api/ai/image/route.ts
Phase 1b  Test: POST prompt → get base64 image back
Phase 1c  Add GEMINI_API_KEY to .env.local (already should exist)

Phase 2a  npm install fabric @types/fabric
Phase 2b  Load Google Fonts (BRAND_FONTS) in layout via next/font or <link>
Phase 2c  Create components/image-creator/canvas-editor.tsx
Phase 2d  Test: drop image onto canvas + add text layer

Phase 3a  Add image_layout agent to /api/ai route.ts
Phase 3b  Test: brief → Claude → layout JSON

Phase 4a  Create app/(app)/ai-image/page.tsx (Step 1: brief form)
Phase 4b  Wire Generate → /api/ai (image_layout) → /api/ai/image
Phase 4c  Mount canvas editor with returned image + layers
Phase 4d  Toolbar: font picker, size, color, effect, align
Phase 4e  Add/delete/reorder text layers
Phase 4f  Arabic RTL support (Fabric direction: 'rtl')

Phase 5a  Export PNG (canvas.toDataURL)
Phase 5b  Save to Library (useCreateAsset)
Phase 5c  Add to Publishing (open compose dialog with image pre-filled)

Phase 6   Add "AI Image" to sidebar nav
```

---

## File Map

| File | Phase | Type |
|------|-------|------|
| `app/api/ai/image/route.ts` | 1 | Create |
| `app/api/ai/route.ts` | 3 | Edit — add `image_layout` agent |
| `components/image-creator/canvas-editor.tsx` | 2 | Create |
| `components/image-creator/text-layer-toolbar.tsx` | 2 | Create |
| `app/(app)/ai-image/page.tsx` | 4 | Create |
| `components/layout/sidebar.tsx` | 6 | Edit — add nav item |
| `lib/hooks/use-assets.ts` | 5 | Edit — add `useCreateAsset()` |

---

## Scope Boundary

- **No multi-image generation** — one background per session
- **No element layers** — background + text only (by design, first version)
- **No video generation** — separate Higgsfield plan
- **No template saving** — user saves to library, can duplicate from there
- **No collaboration** — one user edits at a time
- **No undo/redo** — Fabric.js supports it but adds complexity; out of scope for v1
- **No AI font selection enforcement** — Claude suggests, user can override any property
