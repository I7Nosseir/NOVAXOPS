-- ============================================================
-- MIGRATION 002 — NEW CLIENT ACCOUNTS
-- Date: 2026-05-21
-- Clients: IPC Clinic, Lusin Dining, Okema, Esplanade Mall
-- Metricool userId: 4837620
-- ============================================================

-- ============================================================
-- CLIENTS
-- ============================================================

-- IPC Clinic
-- Metricool: blogId=6276675, primary platform: TikTok
WITH ipc AS (
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
    'IPC Clinic',
    'IC',
    '#0891b2',
    'active',
    '{
      "primary_color": "#0891b2",
      "secondary_color": "#0e7490",
      "tone_of_voice": "Professional, reassuring, informative",
      "target_audience": "Patients and healthcare seekers, families",
      "industry": "Healthcare & Medical",
      "key_messages": [
        "Expert care you can trust",
        "Your health, our priority",
        "Compassionate, professional service"
      ],
      "logo_url": ""
    }',
    '[]',
    '{}',
    '6276675'
  )
  RETURNING id
),

-- Lusin Dining
-- Metricool: blogId=6282341, primary platform: Instagram
lusin AS (
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
    'Lusin Dining',
    'LD',
    '#d97706',
    'active',
    '{
      "primary_color": "#d97706",
      "secondary_color": "#92400e",
      "tone_of_voice": "Warm, inviting, authentic",
      "target_audience": "Dining enthusiasts and food lovers, families 25-50",
      "industry": "Food & Beverage",
      "key_messages": [
        "Authentic flavors, unforgettable moments",
        "Where every meal tells a story",
        "Crafted with passion"
      ],
      "logo_url": ""
    }',
    '[]',
    '{}',
    '6282341'
  )
  RETURNING id
),

-- Okema
-- Metricool: blogId=6282355, primary platform: Instagram
okema AS (
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
    'Okema',
    'OK',
    '#7c3aed',
    'active',
    '{
      "primary_color": "#7c3aed",
      "secondary_color": "#4c1d95",
      "tone_of_voice": "Bold, modern, confident",
      "target_audience": "Young professionals and lifestyle-driven consumers 20-40",
      "industry": "Lifestyle",
      "key_messages": [
        "Define your style",
        "Quality without compromise",
        "Made for those who lead"
      ],
      "logo_url": ""
    }',
    '[]',
    '{}',
    '6282355'
  )
  RETURNING id
),

-- Esplanade Mall
-- Metricool: blogId=6282367, primary platform: Facebook Page
esplanade AS (
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
    'Esplanade Mall',
    'EM',
    '#1d4ed8',
    'active',
    '{
      "primary_color": "#1d4ed8",
      "secondary_color": "#1e3a8a",
      "tone_of_voice": "Vibrant, community-focused, energetic",
      "target_audience": "Shoppers, families, and local community",
      "industry": "Retail & Entertainment",
      "key_messages": [
        "Your destination for everything",
        "Shop, dine, experience",
        "Where the community comes together"
      ],
      "logo_url": ""
    }',
    '[]',
    '{}',
    '6282367'
  )
  RETURNING id
)

-- ============================================================
-- STARTER PROJECTS (one per client — required for task creation)
-- ============================================================

INSERT INTO public.projects (
  client_id,
  name,
  status,
  start_date,
  end_date,
  quarter_strategy
)
SELECT id, 'Social Media Management Q2–Q4 2026', 'active'::project_status, '2026-06-01'::date, '2026-12-31'::date,
  '{"goals": ["Build brand awareness", "Grow followers", "Drive engagement"], "themes": [], "kpis": []}'::jsonb
FROM ipc

UNION ALL

SELECT id, 'Social Media Management Q2–Q4 2026', 'active'::project_status, '2026-06-01'::date, '2026-12-31'::date,
  '{"goals": ["Build brand awareness", "Drive foot traffic", "Grow online community"], "themes": [], "kpis": []}'::jsonb
FROM lusin

UNION ALL

SELECT id, 'Social Media Management Q2–Q4 2026', 'active'::project_status, '2026-06-01'::date, '2026-12-31'::date,
  '{"goals": ["Build brand identity", "Grow audience", "Drive conversions"], "themes": [], "kpis": []}'::jsonb
FROM okema

UNION ALL

SELECT id, 'Social Media Management Q2–Q4 2026', 'active'::project_status, '2026-06-01'::date, '2026-12-31'::date,
  '{"goals": ["Drive foot traffic", "Promote tenant events", "Build community engagement"], "themes": [], "kpis": []}'::jsonb
FROM esplanade;

-- ============================================================
-- VERIFY
-- ============================================================

SELECT id, name, initials, color, status, metricool_blog_id, created_at
FROM public.clients
WHERE name IN ('IPC Clinic', 'Lusin Dining', 'Okema', 'Esplanade Mall')
ORDER BY created_at;
