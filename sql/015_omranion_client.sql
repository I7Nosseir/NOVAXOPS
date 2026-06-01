-- ============================================================
-- MIGRATION 015 — OMRANION CLIENT
-- Date: 2026-06-01
-- Metricool: blogId=6329305, userId=4837620
-- Industry: Real Estate / Construction
-- ============================================================

WITH omranion AS (
  INSERT INTO public.clients (
    name,
    initials,
    color,
    status,
    brand_identity_json,
    competitor_context_json,
    reference_links,
    metricool_blog_id
  ) VALUES (
    'Omranion',
    'OR',
    '#b45309',
    'active',
    '{
      "primary_color": "#b45309",
      "secondary_color": "#78350f",
      "tone_of_voice": "Aspirational, authoritative, quality-focused",
      "target_audience": "Property buyers, investors, and developers seeking quality real estate",
      "industry": "Real Estate & Construction",
      "key_messages": [
        "Building spaces that inspire",
        "Quality craftsmanship, lasting value",
        "Your vision, our expertise"
      ],
      "logo_url": ""
    }',
    '[]',
    '{}',
    '6329305'
  )
  RETURNING id
)

INSERT INTO public.projects (
  client_id,
  name,
  status,
  start_date,
  end_date,
  quarter_strategy
)
SELECT id, 'Social Media Management Q2–Q4 2026', 'active'::project_status, '2026-06-01'::date, '2026-12-31'::date,
  '{"goals": ["Build brand awareness", "Showcase projects", "Drive leads"], "themes": [], "kpis": []}'::jsonb
FROM omranion;

-- ============================================================
-- VERIFY
-- ============================================================

SELECT id, name, initials, color, status, metricool_blog_id, created_at
FROM public.clients
WHERE name = 'Omranion';
