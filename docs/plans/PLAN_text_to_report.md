# Plan: Raw Text to Report

**Status:** Partially built — `/api/reports/analyze` returns markdown text. UI and export not built.  
**Priority:** Medium-high — client-facing deliverable, direct time savings  
**Estimated complexity:** Medium (1–2 sessions)

---

## What it is

Paste raw data, upload screenshots, or dump exported CSVs from any analytics tool → get a formatted, branded, professional report back. One click to download as PDF or PowerPoint. Zero manual formatting.

The existing `/api/reports/analyze` route (Gemini) already extracts metrics and writes structured markdown. The missing piece is: converting that markdown into a real, visually rich document.

---

## Current State (what exists)

- `app/(app)/reports/page.tsx` — exists, has report builder UI
- `app/api/reports/analyze` — Gemini-based, accepts text + up to 5 image screenshots, returns markdown
- Returns sections: Executive Summary, Key Metrics, Performance Analysis, Platform Breakdown, Trend Observations, Strategic Recommendations

---

## What needs to be built

### 1. Upgrade the Report Builder UI (`reports/page.tsx`)

**Input improvements:**
- Raw text paste area (already partially there)
- Screenshot upload (drag & drop, up to 5 images)
- CSV/Excel file upload → auto-parse into structured data before sending to AI
- Metricool "Pull Live Data" button → calls `/api/metricool/analytics` → auto-fills the text area with real numbers
- Report type selector: Monthly / Quarterly / Campaign / Platform Deep Dive / Executive Summary

**Output improvements (currently shows raw markdown):**
- Render the markdown in a styled, NOVAX-branded preview panel
- Section headers in brand teal (`#1B3D38`)
- Key metrics in highlighted callout boxes
- Tables rendered as proper HTML tables with alternating row colors
- Bold numbers pulled out as large KPI cards
- Recommendations numbered and visually distinct

### 2. Visual Charts (auto-generated from extracted data)

The AI returns structured JSON alongside the text report. Use that JSON to render:
- **Bar chart:** Platform comparison (reach, ER per platform) — Recharts BarChart
- **Line chart:** Trend over time if multi-period data — Recharts LineChart
- **Pie/Donut chart:** Content mix or platform distribution
- **KPI cards:** 3–5 large numbers at the top (total reach, avg ER, top platform, follower growth)

To enable this: modify `/api/reports/analyze` to return both:
```json
{
  "text": "## Executive Summary\n...",
  "data": {
    "kpis": [{ "label": "Total Reach", "value": "847K", "change": "+12%" }],
    "platforms": [{ "name": "Instagram", "reach": 520000, "er": 4.2 }],
    "trend": [{ "period": "Week 1", "reach": 180000 }, ...]
  }
}
```

### 3. Export to PDF

Use `@react-pdf/renderer` or `html2canvas + jsPDF` to export the rendered report:
- Capture the styled report preview as HTML → PDF
- Include charts as SVG screenshots
- NOVAX branding: logo in header, teal accent color, dark footer
- File name: `NOVAX_[ClientName]_[ReportType]_[Month]_[Year].pdf`

**Alternative (simpler):** `window.print()` with a dedicated print CSS class that hides all UI chrome and shows only the report panel. No extra library needed.

### 4. Export to PowerPoint (pptxgenjs — already installed)

Generate a `.pptx` with one slide per report section:
- Slide 1: Cover — client name, report type, date, NOVAX logo
- Slide 2: Executive Summary (3 bullet KPI callouts)
- Slide 3: Key Metrics table
- Slide 4: Performance Analysis text + chart image
- Slide 5: Platform Breakdown (bar chart)
- Slide 6: Recommendations (3 numbered points)

pptxgenjs is already in `package.json`. Route: `POST /api/reports/export-pptx` accepts the structured data + text, returns binary .pptx.

### 5. Report History

Save generated reports to the `reports` table (already in schema):
- Report type, client, generated text, data JSON, created_at
- List in the Reports page left panel
- Click to reload a previous report

---

## API Changes

### Modify `POST /api/reports/analyze`
Add structured JSON extraction alongside markdown:
```typescript
// After generating markdown, ask Claude/Gemini to also extract structured data
const structurePrompt = `From the report above, extract a JSON object with:
{ kpis: [{label, value, change}], platforms: [{name, reach, er}], trend: [{period, value}] }
Return only valid JSON, no explanation.`
```
Return both `text` and `data` in the response.

### New: `POST /api/reports/export-pptx`
- Accepts: structured data + markdown text + client name + report type
- Builds pptxgenjs presentation
- Returns binary file with `Content-Disposition: attachment`

---

## Implementation Order

1. Modify `/api/reports/analyze` to return structured `data` JSON alongside `text`
2. Build styled report preview panel (render markdown with NOVAX styling)
3. Add KPI cards + auto-generated charts from structured data
4. Add PDF export (print CSS method — fast, no extra deps)
5. Add PowerPoint export via pptxgenjs route
6. Add Metricool "Pull Live Data" button
7. Add CSV/Excel upload auto-parsing
8. Add report history (save to `reports` table)

---

## Design Notes

- Report preview should look like an actual agency report, not a web page
- White background, teal section headers, gray body text, brand-colored charts
- When user opens the export, it should be indistinguishable from something manually made in Canva/Notion
- KPI cards at top: large number, label below, small change indicator (green up / red down)
- No emojis. Clean, professional, data-led.
