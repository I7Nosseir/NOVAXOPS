-- Migration 037: Work Diary Pulse Tracking
-- Adds efficiency score, content quality score, and pulse signals
-- (predefined turnover-risk + engagement signals) to work_diaries.
-- Safe to re-run — all guarded with IF NOT EXISTS / DO NOTHING.

ALTER TABLE work_diaries
  ADD COLUMN IF NOT EXISTS efficiency_score     SMALLINT CHECK (efficiency_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS content_quality_score SMALLINT CHECK (content_quality_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pulse_signals        TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN work_diaries.efficiency_score      IS '1=Very low, 5=Peak — how productive the employee felt';
COMMENT ON COLUMN work_diaries.content_quality_score IS '1=Poor, 5=Excellent — satisfaction with quality of output produced';
COMMENT ON COLUMN work_diaries.pulse_signals         IS 'Predefined engagement/risk tags: overloaded, unclear_direction, undervalued, no_growth, team_friction, skill_mismatch, poor_tools, burnout_risk, in_the_zone, proud_of_output, great_teamwork, learned_something, made_impact, excited';
