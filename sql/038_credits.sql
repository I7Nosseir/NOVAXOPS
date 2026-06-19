-- ============================================================
-- MIGRATION 038: Credits System
-- ============================================================
-- Adds credit tracking columns to organizations and users.
-- Credits are org-level monthly limits.
-- Users can have optional daily caps (set by CEO/admin).
-- All deductions use atomic RPCs to avoid race conditions.
-- ============================================================

-- ── Organizations: monthly credit pool ───────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS credits_monthly    INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS credits_used       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_reset_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  ADD COLUMN IF NOT EXISTS branding           JSONB DEFAULT NULL;

-- ── Users: daily credit caps + per-user daily counter ────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS daily_credit_cap    INTEGER DEFAULT NULL,  -- NULL = no per-user cap
  ADD COLUMN IF NOT EXISTS credits_used_today  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_reset_today DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS avatar_url          TEXT DEFAULT NULL;

-- ── Seed NOVAX org with generous limits (they are the scale/internal org) ────
UPDATE organizations
  SET
    credits_monthly  = 99999,
    credits_used     = 0,
    credits_reset_at = NOW() + INTERVAL '1 month'
  WHERE slug = 'novax';

-- ── Atomic credit deduction RPC ──────────────────────────────────────────────
-- Returns true if credits were successfully deducted, false if limit hit.
CREATE OR REPLACE FUNCTION deduct_credits(
  p_org_id  UUID,
  p_user_id UUID,
  p_cost    INTEGER
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_monthly   INTEGER;
  v_org_used      INTEGER;
  v_user_cap      INTEGER;
  v_user_today    INTEGER;
  v_reset_today   DATE;
BEGIN
  -- Lock the org row for atomic update
  SELECT credits_monthly, credits_used
  INTO v_org_monthly, v_org_used
  FROM organizations
  WHERE id = p_org_id
  FOR UPDATE;

  -- Check org-level limit
  IF (v_org_used + p_cost) > v_org_monthly THEN
    RETURN false;
  END IF;

  -- Check user daily cap (if set)
  SELECT daily_credit_cap, credits_used_today, credits_reset_today
  INTO v_user_cap, v_user_today, v_reset_today
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  -- Reset user daily counter if it's a new day
  IF v_reset_today < CURRENT_DATE THEN
    v_user_today  := 0;
    v_reset_today := CURRENT_DATE;
  END IF;

  -- Enforce per-user daily cap if set
  IF v_user_cap IS NOT NULL AND (v_user_today + p_cost) > v_user_cap THEN
    RETURN false;
  END IF;

  -- Deduct from org
  UPDATE organizations
    SET credits_used = credits_used + p_cost
    WHERE id = p_org_id;

  -- Update user daily counter
  UPDATE users
    SET
      credits_used_today  = v_user_today + p_cost,
      credits_reset_today = v_reset_today
    WHERE id = p_user_id;

  RETURN true;
END;
$$;

-- ── Monthly credit reset RPC (called by cron job) ────────────────────────────
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE organizations
    SET
      credits_used     = 0,
      credits_reset_at = NOW() + INTERVAL '1 month'
    WHERE credits_reset_at <= NOW();
END;
$$;

-- ── Daily user credit reset RPC (called by cron job) ─────────────────────────
CREATE OR REPLACE FUNCTION reset_daily_user_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
    SET
      credits_used_today  = 0,
      credits_reset_today = CURRENT_DATE
    WHERE credits_reset_today < CURRENT_DATE;
END;
$$;
