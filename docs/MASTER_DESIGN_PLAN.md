# NOVAX OPS — MASTER DESIGN PLAN 2026
## "Aurora Command" — Where Precision Intelligence Meets Organic Depth

---

## RESEARCH SYNTHESIS

### What We Studied

**Claude Design (Anthropic Labs, April 2026)**
Claude Design's default aesthetic produces card-based layouts, soft gradient heroes, neutral sans-serif type, and muted palettes. The official guidance is to *transcend* this — commit to a specific direction: brutalist, editorial, luxury, or retro-futuristic. The "Taste skill" captures aesthetic judgment so Claude applies it consistently. This is exactly what we're doing here — writing the taste profile for NOVAX.

**Linear** — razor precision, monochrome + 1 accent, 1px inset borders, dense typography, keyboard-first, dark-by-default. Every pixel earns its place.

**Vercel** — aurora gradients, WebGL-quality CSS backgrounds, clean hierarchy, performance as aesthetic.

**Stripe** — storytelling through motion, smooth-scroll narrative sections, purple as permission for darkness.

**Arc Browser / Raycast** — personality in dark UI, command palette as primary navigation, joy in tool use.

**Apple (2019–2026)** — breathing room, typography hierarchy, SF-inspired spatial system, product as hero.

**Airbnb** — emotion-first design, filtering by feeling not specs, photo as truth.

**Figma** — multiplayer real-time, collaborative infrastructure visible in the UI itself.

**Notion** — flexible workspace, everything is a block, ambient intelligence.

**Top 2026 Trends Used Here:**
- Aurora UI (breathing gradient mesh backgrounds — CSS-based, GPU-composited)
- Bento grid layouts 2.0 (asymmetric, hover micro-interactions)
- Single accent color + monochrome discipline
- Glassmorphism with motion (not static frost)
- Loading states as brand moments (not gray rectangles)
- Command palette as cognitive prosthesis
- Number count-up animations
- Staggered entry choreography

---

## THE DESIGN DIRECTION

**Name:** Aurora Command
**Essence:** An intelligence layer that feels alive. The interface breathes. Data surfaces with authority. Every AI interaction feels like consulting a brilliant colleague.

**Personality words:** Precise. Luminous. Confident. Alive. Disciplined.
**Anti-words:** Cluttered. Generic. Cold. Flat. Aggressive.

---

## TYPOGRAPHY SYSTEM

```
Display (Hero headings)
  Font: Geist (already installed)
  Sizes: 56px / 72px
  Weight: 300 (thin) or 700 (bold) — nothing between for headings
  Tracking: -0.03em to -0.05em (tighter at larger sizes)
  Color: #E8F0EF (near-white, teal-warm)

Section Headings (H2)
  Size: 32px–40px
  Weight: 600
  Tracking: -0.02em

Page Headings (H3)
  Size: 20px–24px
  Weight: 600
  Tracking: -0.01em

Body
  Size: 14px–15px
  Weight: 400
  Line-height: 1.6
  Color: #9ABCBA

Caption / Label
  Size: 11px–12px
  Weight: 500
  Tracking: 0.04em (wider — reads as labels)
  Color: #4E6D6A

Numeric / Data
  Font: Geist Mono
  Size: context-dependent (18px for KPIs, 13px for tables)
  Color: #5BB4AE (accent) or #E8F0EF

Gradient Text (use sparingly — hero + section highlights only)
  linear-gradient(135deg, #5BB4AE 0%, #2A6B62 60%, #E8F0EF 100%)
```

---

## COLOR ARCHITECTURE

```
Canvas (base)         #030C0B    deepest dark
Surface 0             #04100F    body background
Surface 1             #080F0E    sidebar, panels
Surface 2             #0D1917    cards, drawers
Surface 3             #111E1C    raised elements
Surface 4             #172621    highlighted rows, hover

Aurora teal (brand)   #1B3D38    novax primary
Aurora muted          #2A6B62    novax-muted
Accent vivid          #5BB4AE    novax-accent  ← the SINGLE accent
Accent dim            #3A8B86    secondary accent state
Light wash            #EBF4F3    novax-light

Text primary          #E8F0EF    headings, important labels
Text secondary        #9ABCBA    body, descriptions
Text tertiary         #4E6D6A    captions, disabled
Text accent           #5BB4AE    links, highlights, active states

Destructive           oklch(0.704 0.191 22.216)
Warning               #D4A84B    amber — crisis mode, warnings
Success               #4BB86A    green — completion, published

Glow palette:
  xs glow    rgba(91, 180, 174, 0.15)
  sm glow    rgba(91, 180, 174, 0.25)
  md glow    rgba(91, 180, 174, 0.40)
  lg glow    rgba(91, 180, 174, 0.55)
  pulse glow rgba(91, 180, 174, 0.70)
```

---

## SPATIAL SYSTEM

```
Base unit: 4px

Space scale:
  1  →  4px    (icon gap, tight row padding)
  2  →  8px    (button padding, inline items)
  3  →  12px   (element spacing)
  4  →  16px   (component padding)
  5  →  20px   (section gap within card)
  6  →  24px   (card padding)
  8  →  32px   (section spacing)
  10 →  40px   (major section gaps)
  12 →  48px   (hero spacing)
  16 →  64px   (page-level breathing room)

Border radius:
  xs   4px    (badges, chips)
  sm   6px    (inputs, small cards)
  md   8px    (standard cards)
  lg   12px   (large cards, modals)
  xl   16px   (panels)
  2xl  20px   (sheets, drawers)
  full 9999px (pills, avatars)
```

---

## ANIMATION VOCABULARY

```
Entry animations:
  fade-in-up     0.30s ease-out     Standard content reveal
  fade-in-scale  0.25s ease-out     Modals, dropdowns
  blur-in        0.40s ease-out     Page transitions (opacity + blur 8px→0)
  slide-in-right 0.35s ease-out     Panels, drawers
  cascade-in     0.60s ease-out     Hero text (stagger each word)

Hover interactions:
  lift           translateY(-2px) + glow-sm    0.20s ease
  press          scale(0.97) + glow-xs         0.08s ease
  glow-pulse     box-shadow animation           2.5s infinite

Stagger system:
  Item 1: delay 0ms
  Item 2: delay 45ms
  Item 3: delay 90ms
  Item 4: delay 135ms
  Item 5: delay 180ms
  Item 6: delay 225ms
  (max 8 items staggered; beyond that use 0ms)

Easing curves:
  ease-out-expo  cubic-bezier(0.16, 1, 0.3, 1)    snappy entries
  ease-in-expo   cubic-bezier(0.7, 0, 0.84, 0)     decisive exits
  spring         cubic-bezier(0.34, 1.56, 0.64, 1) playful bounce

Number count-up:
  Duration: 800ms
  Easing: ease-out-expo
  Start: 0 or previous value
  Trigger: element enters viewport

Aurora background:
  Cycle: 12s ease-in-out infinite
  Breathes gently — never pulses aggressively
  Three overlapping radial gradients shift position slowly
  GPU-composited CSS only (no WebGL, no JS animation overhead)
```

---

## LOADING STATE SYSTEM (5 Archetypes)

### 1. Aurora Loader (Page-level full-screen)
Full-screen dark canvas. Three aurora blobs (teal, deep teal, accent) animate slowly.
NOVAX wordmark assembles from letters (each letter fades in from blur).
Tagline appears below as a soft glow.
Progress bar: thin teal line that fills from left, glow at the leading edge.
Duration: 600ms minimum, dismisses when content is ready.
Use for: first load, studio tool launch, report generation.

### 2. Orbital Loader (Component-level, medium)
3 dots on an invisible orbit path. Each dot has a teal glow trail.
Orbit period: 1.2s. Dots are offset 120° apart.
Diameter: 40px for inline, 80px for card-center.
Use for: AI generation, data fetching inside a card, async saves.

### 3. Scan Line Loader (Content reveal)
Horizontal teal gradient line sweeps from top to bottom.
Content is revealed beneath it (opacity 0→1 as the line passes).
Duration: 800ms total sweep.
Use for: pipeline board loading, table loading, asset grid loading.

### 4. Signal Pulse (Status / waiting)
Concentric rings expand from center logo/icon.
First ring: solid teal 2px. Second: rgba at 50%. Third: rgba at 20%.
Period: 2s, infinite.
Use for: "waiting for AI response", "publishing in progress", "sync running".

### 5. Shimmer Skeleton (List / card placeholders)
NOT gray rectangles — shape-matched to the actual content.
Shimmer color: teal spectrum (not gray).
shimmer-teal: linear-gradient(90deg, rgba(91,180,174,0.04) 0%, rgba(91,180,174,0.12) 50%, rgba(91,180,174,0.04) 100%)
animates background-position 200% → -200%.
Card skeleton shows exact card shape: header bar, 3 text lines, footer.
Use for: task cards, KPI cards, post grid items, table rows.

---

## COMPONENT-LEVEL REDESIGN SPECS

### Sidebar (width: 56px collapsed / 240px expanded)
- Background: #080F0E with fixed aurora blob in top-left corner (static, no animation)
- Section dividers: 1px horizontal rule, linear-gradient(to right, transparent, rgba(91,180,174,0.15), transparent)
- Active item: left 2.5px border (linear-gradient teal to dark-teal) + rgba(91,180,174,0.08) background + text: #E8F0EF
- Inactive item: text #4E6D6A, hover → #9ABCBA + rgba(91,180,174,0.04) bg
- Badge counts: teal bg (#1B3D38), teal text (#5BB4AE), 1px border rgba(91,180,174,0.3)
- Keyboard shortcut hints: appear on item hover, right-aligned, monospace 11px, #3D5A57
- Section labels: 10px caps, tracking 0.08em, #3A5250

### Header (height: 52px)
- Background: rgba(4,16,15,0.85) + backdrop-filter: blur(24px) saturate(160%)
- Bottom border: 1px linear-gradient(90deg, transparent, rgba(91,180,174,0.4) 20%, rgba(91,180,174,0.7) 50%, rgba(91,180,174,0.4) 80%, transparent)
- Search bar → Command Palette trigger (⌘K): glass input, placeholder "Search anything..." with fade-in animation
- New Task button: btn-novax-glow style
- Notification bell: teal signal-pulse animation when count > 0

### Command Palette (⌘K)
- Full-screen overlay: rgba(4,16,15,0.85) backdrop
- Centered modal: 560px wide, glassmorphism L4
- Search input: 18px, Geist, no border, autofocus
- Results: grouped by type (Tasks / Clients / Documents / Studio / Actions)
- Selected item: teal left border + Surface 3 background
- Keyboard hints: ↑↓ navigate, ↵ open, esc dismiss

### Dashboard KPI Cards (Bento Grid)
- Layout: CSS grid, asymmetric. 2 cols on md, 4 cols on lg.
- Hero stat card spans 2 cols: large number (48px Geist Mono), sparkline below
- Standard cards: number animate count-up on mount
- Corner accent: small aurora orb (radial gradient) in top-right, opacity 0.15
- Label: 11px caps tracking 0.06em
- Delta indicator: up/down arrow + percentage in teal (positive) or destructive (negative)
- On hover: translateY(-2px), glow-xs appears, border color transitions to rgba(91,180,174,0.25)

### Task Cards (Pipeline)
- Left border: 3px solid — color encodes priority (teal=low, amber=medium, destructive=high)
- Body: Surface 2 (#0D1917), 1px border rgba(255,255,255,0.065)
- Client avatar chip: small pill with client color
- Due date: Geist Mono 11px
- AI badge (if AI output exists): tiny teal sparkle indicator top-right
- Drag ghost: 50% opacity + glow-sm

### Studio Tool Cards (Hub page)
- Full glass-card treatment
- Background: tool-specific aurora blob (content=teal, strategy=amber, campaign=purple-tinted)
- Tool icon: 32px, displayed in accent color
- "Recent session" subtitle: Geist Mono 11px
- Hover: lift + glow-md

### Inputs and Forms
- Default: Surface 3 background, 1px border rgba(255,255,255,0.10)
- Focus: 1.5px border rgba(91,180,174,0.65), outer glow ring rgba(91,180,174,0.12) 0 0 0 3px
- Label: floating — sits inside at 50% y when empty, animates to top (12px caps) on focus/filled
- Placeholder: #3A5250
- Error: destructive border + shake animation (translateX: 0 → -4px → 4px → -2px → 0, 200ms)

### Buttons
- Primary: bg-novax (#1B3D38), hover: glow + slight lighten, active: scale(0.97)
- Secondary: Surface 3, 1px border rgba(91,180,174,0.2), hover: border rgba(91,180,174,0.4)
- Ghost: no background, text-novax-accent, hover: Surface 3 background
- Destructive: oklch destructive bg, hover: glow destructive
- All: 8px radius, 14px text, 500 weight, 36px height standard

---

## PAGE-LEVEL EXPERIENCES

### Dashboard
- Hero stat row (animated count-up on mount, stagger 45ms each)
- Weekly activity chart (animate bars drawing up from 0)
- Bento grid below: pipeline stats, moderation queue, AI usage, Metricool preview
- Entry: blur-in at page mount, stagger-grid for cards

### Pipeline
- Glass column headers with stage emoji removed → colored dot + label
- Columns enter with stagger-right (each column slides in +30ms)
- Empty state: dashed border + "Drop tasks here" (fade in)
- Task count badge per column: teal pill

### Studio Pages
- Full-viewport aurora background on entry
- Tool-specific color accent (each tool has its own "signature")
- Loading: Aurora Loader (full-screen) while AI generates
- Output: Scan Line reveal when content arrives
- Boss Brief: appears last, amber/gold accent card

### AI Assistant (/assistant)
- Split view: conversation left, context panel right
- Messages animate in as they stream (words appear one by one)
- AI messages: subtle aurora bg behind the bubble
- Thinking state: Orbital Loader inline

### Content Library / Assets
- Masonry grid (not uniform rows)
- Scan Line reveal on load
- Card hover: scale(1.02) + shadow elevation

---

## THE CLAUDE DESIGN PROMPT

Copy and paste this entire block into Claude Design to scaffold any new screen or component:

---

```
DESIGN SYSTEM: NOVAX OPS — Aurora Command v2

AESTHETIC DIRECTION: Luxury dark SaaS. Precision intelligence meets organic depth.
Reference: Linear (density + monochrome discipline) × Vercel (aurora backgrounds)
× Stripe (storytelling motion) × Apple (breathing room, hierarchy).
ANTI-PATTERNS: No gradients on white. No purple. No rounded blob illustrations.
No emojis in the UI. No hashtags. No stock photography. Icons only (lucide-react).

CORE PALETTE:
  Canvas: #04100F  
  Card surface: #0D1917
  Raised: #111E1C
  Brand accent (ONLY ONE): #5BB4AE (teal)
  Text primary: #E8F0EF
  Text secondary: #9ABCBA
  Text tertiary: #4E6D6A
  Warning: #D4A84B
  Destructive: oklch(0.704 0.191 22.216)

TYPOGRAPHY:
  All text: Geist (Next.js built-in). Numbers/data: Geist Mono.
  Headings: -0.02em to -0.04em tracking, weights 300 or 700 only.
  Body: 14px, 400 weight, 1.6 line-height.
  Labels: 11px caps, 0.06em tracking, 500 weight.
  NO Inter. NO Roboto. NO system-ui for display.

SURFACES (5 levels):
  L0 Canvas: #04100F
  L1 Surface: #080F0E (sidebar)
  L2 Card: #0D1917 (cards, panels)
  L3 Raised: #111E1C (inputs, rows)
  L4 Glass: rgba(255,255,255,0.05) + backdrop-filter: blur(22px) + 1px rgba(255,255,255,0.08) border

GLOW SYSTEM (teal only):
  xs: box-shadow: 0 0 10px rgba(91,180,174,0.15)
  sm: box-shadow: 0 0 18px rgba(91,180,174,0.25)
  md: box-shadow: 0 0 28px rgba(91,180,174,0.40), 0 0 56px rgba(91,180,174,0.12)
  lg: box-shadow: 0 0 40px rgba(91,180,174,0.55), 0 0 80px rgba(91,180,174,0.18)

AURORA BACKGROUND (dark screens):
  Three overlapping CSS radial gradients animating slowly (12s cycle):
  - Top-left: rgba(27,61,56,0.55) ellipse
  - Bottom-right: rgba(42,107,98,0.35) ellipse
  - Center: rgba(91,180,174,0.04) ellipse
  Base: #04100F
  Do NOT use WebGL. CSS only. background-attachment: fixed.

CARD STYLE:
  border-radius: 10px
  border: 1px solid rgba(255,255,255,0.07)
  background: rgba(255,255,255,0.038)
  backdrop-filter: blur(22px) saturate(155%)
  box-shadow: 0 1px 2px rgba(0,0,0,0.22), 0 4px 18px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.065)
  hover: translateY(-2px), glow-xs, border rgba(91,180,174,0.18)

ACTIVE SIDEBAR ITEM:
  Left 2.5px border: linear-gradient(to bottom, #5BB4AE, #2A6B62)
  Left border box-shadow: 0 0 12px rgba(91,180,174,0.7)
  Background: rgba(91,180,174,0.08)
  Text: #E8F0EF

BUTTON PRIMARY:
  background: #1B3D38
  border: 1px solid rgba(91,180,174,0.2)
  box-shadow: 0 0 0 1px rgba(91,180,174,0.15), 0 2px 8px rgba(0,0,0,0.3)
  hover: background #163330, glow-sm, translateY(-1px)

ANIMATION RULES:
  Entries: opacity 0 → 1 + translateY(12px) → 0, duration 300ms, ease-out
  Stagger: 45ms per child item
  Hover lift: translateY(-2px) + glow transition, 200ms ease
  Active press: scale(0.97), 80ms
  Page transition: blur 8px → 0 + opacity 0 → 1, 400ms

LOADING STATES (three archetypes):
  1. Full-page: Aurora background + NOVAX wordmark assembling + thin teal progress bar
  2. Component: 3 orbital dots (teal, 120° offset, 1.2s period) with glow trails
  3. Content reveal: teal shimmer skeleton matching exact content shape

TEXT GRADIENT (hero only):
  background: linear-gradient(135deg, #5BB4AE 0%, #2A6B62 55%, #E8F0EF 100%)
  -webkit-background-clip: text
  -webkit-text-fill-color: transparent

BENTO GRID (Dashboard):
  CSS grid, 4 columns desktop, asymmetric sizing (hero card: col-span-2)
  Numbers: Geist Mono, animated count-up on viewport entry
  Corner aurora: radial-gradient top-right, opacity 0.12, non-interactive

WHAT TO NEVER DO:
  - No emojis, hashtags, or decorative text
  - No purple, pink, or warm orange in the main palette
  - No gray skeleton loaders (use teal shimmer)
  - No card shadows that use blue-gray (use pure black + teal glow)
  - No navigation tabs with colored backgrounds
  - No chart pie charts (use bar or area charts)
  - No stock illustrations or blob shapes
  - No Inter or Roboto fonts
  - No border-radius above 20px on main cards
```

---

## LANDING PAGE DESIGN BRIEF (PAS FORMULA)

### Structure
1. Nav → Hero → Problem → Agitate → Solution → Feature Bento → CTA
2. Full dark background with aurora mesh
3. Scroll-triggered animations (IntersectionObserver, no JS library needed)
4. Product screenshot mockups in glass frames
5. One CTA color throughout: `#5BB4AE` teal buttons

### Section Copy

**HERO**
- Pre-title: "FOR CREATIVE AGENCIES" (caps, teal, 12px tracking)
- H1: "The Operations Platform Your Agency Has Been Missing"
- Sub: "Strategy to publishing, powered by AI. One platform. Every tool. Zero context-switching."
- CTA: "Request Access" + "See the Platform" (ghost)

**PROBLEM (P)**
- H2: "Your creative workflow is brilliant in theory."
- Sub: "In reality, it's five tools fighting each other."
- Bullets: 4 core pains with X marks

**AGITATE (A)**  
- H2: "Every. Single. Day."
- 3 stat cards (animated count): 47 context switches / 3.4 hours lost / 68% AI content abandoned
- Paragraph: the human cost

**SOLUTION (S)**
- H2: "NOVAX Ops. One Command Center."
- Feature cards: 6 core capabilities with app screenshots
- "Powered by Claude AI" attribution

**BENTO FEATURES**
- 8-cell asymmetric bento grid

**CTA**
- H2: "Your agency is ready for this."
- Sub + access form

---

## IMPLEMENTATION PRIORITY

### Sprint 1 (Foundation — this session)
- [x] Master design plan (this doc)
- [ ] globals.css — aurora animations, loading keyframes, bento utilities
- [ ] AuroraLoader component (full-page)
- [ ] OrbitalLoader component (inline)
- [ ] ShimmerSkeleton component (content placeholders)
- [ ] Landing page (PAS, full dark, aurora bg)

### Sprint 2 (Core Surfaces)
- [ ] Dashboard → Bento grid layout, count-up KPIs, asymmetric cards
- [ ] Sidebar → Narrower, keyboard hints, new active indicator
- [ ] Header → Command Palette (⌘K) modal
- [ ] Typography audit — enforce Geist + caps labels everywhere

### Sprint 3 (Studio Elevation)
- [ ] Studio pages → full-viewport aurora entry, per-tool color signatures
- [ ] Loading integration — Aurora Loader on all AI calls
- [ ] Output cards → Scan Line reveal animation
- [ ] Boss Brief → gold/amber accent card treatment

### Sprint 4 (Polish)
- [ ] Page transitions (blur-crossfade between routes)
- [ ] Number count-up on all KPI surfaces
- [ ] Drag-and-drop pipeline ghost cards
- [ ] Mobile layout audit
