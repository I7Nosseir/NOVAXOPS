import { createAdminClient } from '@/lib/supabase'

// Per-token cost in USD
const MODEL_COSTS: Record<string, { in: number; out: number }> = {
  'claude-opus-4-7':         { in: 0.000015,    out: 0.000075 },
  'claude-sonnet-4-6':       { in: 0.000003,    out: 0.000015 },
  'gemini-3-flash-preview':  { in: 0.0000000875, out: 0.00000035 },
}

interface TrackUsageParams {
  service: 'claude' | 'gemini'
  endpoint: string
  user_id?: string
  tokens_in: number
  tokens_out: number
  model: string
  was_cached?: boolean
}

export async function trackAiUsage(params: TrackUsageParams): Promise<void> {
  try {
    const db = createAdminClient()
    if (!db) return
    const rates = MODEL_COSTS[params.model] ?? { in: 0, out: 0 }
    const cost_usd = params.tokens_in * rates.in + params.tokens_out * rates.out

    await db.from('api_usage').insert({
      service:      params.service,
      endpoint:     params.endpoint,
      user_id:      params.user_id ?? null,
      tokens_in:    params.tokens_in,
      tokens_out:   params.tokens_out,
      credits_used: cost_usd,
      cost_usd,
      was_cached:   params.was_cached ?? false,
    })
  } catch (err) {
    console.error('[track-usage]', err)
  }
}
