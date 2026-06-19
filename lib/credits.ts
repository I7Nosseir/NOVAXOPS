import { createAdminClient } from '@/lib/supabase'

/**
 * Credit costs per operation type.
 * Cached responses cost 0 — they're already paid for.
 */
export const CREDIT_COST: Record<string, number> = {
  // Basic AI (1 credit)
  post_caption:         1,
  task_analyzer:        1,
  asset_finder:         1,
  moderation_reply:     1,
  humanizer:            1,
  tool_quick:           1,

  // Standard AI (2 credits)
  copywriter:           2,
  researcher:           2,
  studio_chat:          2,
  studio_questions:     2,

  // Studio tools (3 credits)
  studio_content:       3,
  studio_hooks:         3,
  studio_campaign:      3,
  studio_postmortem:    3,
  studio_visual:        3,
  studio_formats:       3,
  studio_copy:          3,
  reel_analysis:        3,

  // Heavy / strategy (5 credits)
  studio_strategy:      5,
  boss_brief:           5,
  presentation_builder: 5,
  report_narrative:     5,
  ceo_strategy:         5,
  ceo_second_opinion:   5,
  ceo_crisis:           5,
}

export type CreditCheckResult =
  | { allowed: true }
  | { allowed: false; reason: 'org_limit' | 'user_daily_cap' | 'org_suspended' }

/**
 * Check whether the org/user can afford `cost` credits, and deduct them atomically.
 * Call this at the top of every AI API route handler.
 *
 * @param orgId   Organization UUID
 * @param userId  User UUID
 * @param cost    Number of credits to deduct (use CREDIT_COST[agentType])
 * @returns CreditCheckResult — if allowed is false, return 402 to the client
 */
export async function checkAndDeductCredits(
  orgId: string,
  userId: string,
  cost: number,
): Promise<CreditCheckResult> {
  // Cost 0 = cached response, always free
  if (cost <= 0) return { allowed: true }

  const supabase = createAdminClient()

  // Check org status first (suspended orgs cannot use any credits)
  const { data: org } = await supabase
    .from('organizations')
    .select('status, credits_monthly, credits_used')
    .eq('id', orgId)
    .single()

  if (!org) return { allowed: false, reason: 'org_limit' }
  if (org.status === 'suspended' || org.status === 'cancelled') {
    return { allowed: false, reason: 'org_suspended' }
  }

  // Use the atomic RPC to check + deduct in one DB round-trip
  const { data: success, error } = await supabase
    .rpc('deduct_credits', {
      p_org_id:  orgId,
      p_user_id: userId,
      p_cost:    cost,
    })

  if (error || !success) {
    // Determine reason: check if it's a daily cap or org limit
    const { data: user } = await supabase
      .from('users')
      .select('daily_credit_cap, credits_used_today')
      .eq('id', userId)
      .single()

    if (user?.daily_credit_cap != null && (user.credits_used_today + cost) > user.daily_credit_cap) {
      return { allowed: false, reason: 'user_daily_cap' }
    }
    return { allowed: false, reason: 'org_limit' }
  }

  return { allowed: true }
}

/**
 * Get credit usage summary for a given org — used in dashboard + settings.
 */
export async function getOrgCreditUsage(orgId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('organizations')
    .select('credits_monthly, credits_used, credits_reset_at')
    .eq('id', orgId)
    .single()
  return data
}

/**
 * Get today's credit usage for a user.
 */
export async function getUserCreditUsageToday(userId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('users')
    .select('credits_used_today, daily_credit_cap, credits_reset_today')
    .eq('id', userId)
    .single()
  return data
}

/**
 * Set per-user daily credit cap (CEO/Admin only — enforce role check in the caller).
 */
export async function setUserDailyCap(userId: string, cap: number | null) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('users')
    .update({ daily_credit_cap: cap })
    .eq('id', userId)
  return !error
}
