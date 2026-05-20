-- ============================================================
-- Privea Dent — Client + Starter Project
-- Run in Supabase SQL Editor → one time only
-- ============================================================

-- Client
INSERT INTO public.clients (
  name,
  initials,
  color,
  status,
  metricool_blog_id,
  brand_identity_json,
  competitor_context_json,
  reference_links
)
VALUES (
  'Privea Dent',
  'PD',
  '#0F766E',                        -- deep teal — update to match actual brand color
  'active',
  '6276264',                        -- your Metricool blog ID
  '{
    "primary_color":    "#0F766E",
    "secondary_color":  "#FFFFFF",
    "tone_of_voice":    "Professional, reassuring, and approachable. Builds trust without clinical coldness.",
    "target_audience":  "Adults 25–55 seeking premium dental care. Value aesthetics, hygiene, and pain-free experience.",
    "key_messages":     ["Expert care you can trust", "A healthy smile starts here", "Comfortable, modern dentistry"],
    "industry":         "Dental / Healthcare",
    "logo_url":         ""
  }',
  '[]',
  '{}'
)
RETURNING id, name, metricool_blog_id;

-- ── Starter project (references the client inserted above) ──────────────────
-- Uses a subquery so this stays portable — no hardcoded UUIDs
INSERT INTO public.projects (
  client_id,
  name,
  status,
  start_date,
  end_date,
  quarter_strategy
)
SELECT
  id,
  'Q2 2026 — Social Media Launch',
  'active',
  '2026-05-01',
  '2026-07-31',
  '{
    "goals":  ["Build brand awareness on Instagram and Facebook", "Drive appointment bookings via social", "Establish authority in premium dental care"],
    "themes": ["Patient transformations", "Behind-the-scenes clinic life", "Dental tips & education", "Promotional offers"],
    "kpis":   ["500 Instagram followers by end of Q2", "10% engagement rate", "20 appointment enquiries per month via social"]
  }'
FROM public.clients
WHERE name = 'Privea Dent'
LIMIT 1;
