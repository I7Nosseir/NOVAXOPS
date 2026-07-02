import type { DeckBranding } from './deck-types'

export interface DesignTemplate {
  id: string
  name: string
  description: string
  preview_color: string  // dominant color shown in the card swatch
  use_case?: string
  branding: DeckBranding
}

export const DECK_DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'novax-default',
    name: 'NOVAX Default',
    description: 'Professional teal and white. Clean, balanced, corporate-ready.',
    preview_color: '#1B3D38',
    use_case: 'Strategy, corporate, B2B',
    branding: {
      background: '#1B3D38',
      surface:    '#FFFFFF',
      primary:    '#1B3D38',
      accent:     '#5BB4AE',
      body:       '#0F172A',
      muted:      '#64748B',
      titleFont:  'Calibri',
      bodyFont:   'Calibri',
    },
  },
  {
    id: 'luxury-dark',
    name: 'Luxury Dark',
    description: 'Deep navy with gold accents. Sophisticated and premium.',
    preview_color: '#0F172A',
    use_case: 'Premium brands, luxury goods, high-end services',
    branding: {
      background: '#0F172A',
      surface:    '#FFFFFF',
      primary:    '#0F172A',
      accent:     '#D4AF37',
      body:       '#FFFFFF',
      muted:      '#B0A89B',
      titleFont:  'Georgia',
      bodyFont:   'Calibri',
    },
  },
  {
    id: 'tech-minimal',
    name: 'Tech Minimal',
    description: 'Clean white with electric blue. Modern and tech-forward.',
    preview_color: '#1E3A8A',
    use_case: 'SaaS, startups, tech companies',
    branding: {
      background: '#F8F9FA',
      surface:    '#FFFFFF',
      primary:    '#1E3A8A',
      accent:     '#0080FF',
      body:       '#1F2937',
      muted:      '#9CA3AF',
      titleFont:  'Helvetica',
      bodyFont:   'Helvetica',
    },
  },
  {
    id: 'energetic',
    name: 'Energetic',
    description: 'Black background with vibrant orange. Bold and eye-catching.',
    preview_color: '#1A1A1A',
    use_case: 'Creative agencies, campaigns, events',
    branding: {
      background: '#1A1A1A',
      surface:    '#FFFFFF',
      primary:    '#FFFFFF',
      accent:     '#FF6B35',
      body:       '#E0E0E0',
      muted:      '#808080',
      titleFont:  'Helvetica',
      bodyFont:   'Helvetica',
    },
  },
  {
    id: 'warm-minimal',
    name: 'Warm Minimal',
    description: 'Cream background with terracotta accents. Inviting and approachable.',
    preview_color: '#C85A54',
    use_case: 'Lifestyle, food, wellness, hospitality',
    branding: {
      background: '#F5F1E8',
      surface:    '#FFFFFF',
      primary:    '#5D4E37',
      accent:     '#C85A54',
      body:       '#3E3629',
      muted:      '#8B7355',
      titleFont:  'Georgia',
      bodyFont:   'Calibri',
    },
  },
]

export function getDeckDesignTemplate(id: string): DesignTemplate | undefined {
  return DECK_DESIGN_TEMPLATES.find(t => t.id === id)
}
