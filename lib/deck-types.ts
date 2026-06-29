export type DeckTemplate = 'campaign' | 'strategy' | 'report' | 'pitch'
export type DeckInputMode = 'ai_generate' | 'exact_text'

export interface DeckBranding {
  background: string   // hex — slide background
  surface: string      // hex — card / panel background
  primary: string      // hex — titles, headings
  accent: string       // hex — tags, bullets, accent bars
  body: string         // hex — body text
  muted: string        // hex — secondary text
  titleFont: string    // PPTX-safe: Calibri | Georgia | Times New Roman | Helvetica
  bodyFont: string
}

export interface DeckSlide {
  id: string
  type: 'cover' | 'executive_summary' | 'section_header' | 'campaign' | 'pillar' | 'metrics' | 'timeline' | 'cta'
  title: string
  subtitle?: string
  body?: string
  bullets?: string[]
  tag?: string    // "Campaign 01" | "Pillar 1" | "why" (second campaign slide)
  note?: string   // speaker notes — not shown in preview
}

export interface DeckDocument {
  title: string
  client_name?: string
  template: DeckTemplate
  branding: DeckBranding
  slides: DeckSlide[]
  generated_at: string
}

export interface DeckStructureRequest {
  session_id?: string
  client_id?: string
  template: DeckTemplate
  mode: DeckInputMode
  prompt: string
  client_name?: string
}

export const NOVAX_BRANDING: DeckBranding = {
  background: '#1B3D38',
  surface:    '#FFFFFF',
  primary:    '#1B3D38',
  accent:     '#5BB4AE',
  body:       '#0F172A',
  muted:      '#64748B',
  titleFont:  'Calibri',
  bodyFont:   'Calibri',
}
