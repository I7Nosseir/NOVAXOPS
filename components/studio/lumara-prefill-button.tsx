'use client'

import { Sparkles } from 'lucide-react'

const LUMARA_ID = 'b1a2c3d4-e5f6-7890-abcd-ef1234567890'

interface LumaraPrefillButtonProps {
  onPrefill: (clientId: string, brief: string) => void
  brief: string
}

export function LumaraPrefillButton({ onPrefill, brief }: LumaraPrefillButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onPrefill(LUMARA_ID, brief)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors shrink-0"
      title="Pre-fill with Lumara demo brand"
    >
      <Sparkles className="w-3 h-3" />
      Try with Lumara
    </button>
  )
}

export const LUMARA_BRIEFS = {
  hooks:    'Launch of Lumara\'s new Barrier Repair Serum — 2ml of ceramides + niacinamide for dehydrated, stressed skin. Target: UAE women 28–38 who have tried everything and are now "skin-informed minimalists." Goal: drive product saves on Instagram.',
  content:  'Lumara Barrier Repair Serum launch week. Show the ritual: apply at night, wake up to visibly calmer skin. Aspirational but real — no CGI glow, actual texture and skin response. Platform: Instagram Reels + Carousel.',
  strategy: 'Q3 strategy for Lumara — UAE luxury skincare brand. Summer heat is damaging skin barriers. Audience is moving away from 10-step routines toward fewer, better products. Ramadan Eid gifting season begins in Q4.',
  campaign: 'Lumara needs a campaign for the post-summer skin repair moment — August/September, UAE. Audience knows their skin is damaged from AC + sun but is too exhausted to start a complex routine again.',
  formats:  'luxury skincare UAE — minimalist rituals, barrier repair, ingredient-led content',
  postmortem: 'Our last reel for Lumara — "5 signs your skin barrier is damaged" — got 12K views but only 40 saves and 3 shares. Average for our account is 80 saves. Posted 8pm Thursday.',
  visual:   'Lumara Barrier Repair Serum. Golden hour, slow and warm. Close-up texture: serum pooling on palm, absorbed into skin. No people — just product and skin.',
} as const
