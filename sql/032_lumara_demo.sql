-- Migration 032: Lumara Demo Brand
-- Phase 4 — Studio Excellence
-- Seeds the "Lumara" demo client used to showcase all studio tools.
-- Safe to re-run (INSERT ... ON CONFLICT DO NOTHING).

INSERT INTO public.clients (
  id,
  name,
  initials,
  color,
  status,
  metricool_blog_id,
  brand_identity_json,
  competitor_context_json,
  crisis_mode
)
VALUES (
  'b1a2c3d4-e5f6-7890-abcd-ef1234567890',
  'Lumara',
  'LM',
  '#C9A96E',
  'active',
  NULL,
  '{
    "industry": "Luxury Skincare",
    "founded": "2021",
    "market": "UAE & GCC",
    "tagline": "Radiance, Refined",
    "website": "https://lumara.ae",
    "platforms": ["Instagram", "TikTok", "YouTube"],
    "target_audience": "Women 25–42, UAE + Saudi Arabia, high-income, beauty-literate, global reference point",
    "tone": "Warm, aspirational, quietly confident. Never pushy. Speaks like a knowledgeable friend, not a brand.",
    "key_messages": [
      "Skin-first formulas developed with dermatologists",
      "Ritual over routine — skincare as self-care",
      "Regional ingredients, global standards"
    ],
    "brand_colors": ["#C9A96E", "#F5EDE0", "#2C1810"],
    "content_pillars": [
      "Product rituals (how to use, in-routine demos)",
      "Ingredient stories (what makes each formula different)",
      "Skin education (barrier care, hydration myths, SPF)",
      "Community UGC (real skin, real results)"
    ],
    "arabic_dialect": "gulf",
    "posts_per_week": 5,
    "avoid": ["Before/after medical claims", "Comparison to prescription products", "Unrealistic results language"]
  }',
  '["@glossier", "@tatcha", "@skinceuticals", "@cetaphil_me", "@kiehls_arabia"]',
  false
)
ON CONFLICT (id) DO NOTHING;

-- Seed competitor snapshots for Lumara (if competitor_snapshots table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'competitor_snapshots'
  ) THEN
    INSERT INTO public.competitor_snapshots (
      id, client_id, competitor_handle, platform, followers, avg_er, posting_frequency, growth_signal, scraped_at
    )
    VALUES
      (gen_random_uuid(), 'b1a2c3d4-e5f6-7890-abcd-ef1234567890', '@tatcha',        'Instagram', 890000,  2.8, 5, 'stable',       now()),
      (gen_random_uuid(), 'b1a2c3d4-e5f6-7890-abcd-ef1234567890', '@glossier',      'Instagram', 2900000, 3.1, 7, 'accelerating', now()),
      (gen_random_uuid(), 'b1a2c3d4-e5f6-7890-abcd-ef1234567890', '@kiehls_arabia', 'Instagram', 145000,  1.9, 4, 'stable',       now())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ── Nike — global reference brand for studio demos ──────────────────────────
INSERT INTO public.clients (
  id,
  name,
  initials,
  color,
  status,
  metricool_blog_id,
  brand_identity_json,
  competitor_context_json,
  crisis_mode
)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef0987654321',
  'Nike',
  'NK',
  '#111111',
  'active',
  NULL,
  '{
    "industry": "Sportswear & Lifestyle",
    "founded": "1964",
    "market": "Global",
    "tagline": "Just Do It",
    "website": "https://nike.com",
    "platforms": ["Instagram", "TikTok", "YouTube", "X (Twitter)"],
    "target_audience": "Athletes and aspirational movers, 16–35, performance-minded but lifestyle-driven. Admires authenticity over polish.",
    "tone": "Empowering, direct, never preachy. Celebrates effort, not just victory. Short sentences. Strong verbs.",
    "key_messages": [
      "Sport is for everyone",
      "Greatness is earned, not given",
      "Innovation in every product"
    ],
    "brand_colors": ["#111111", "#FFFFFF", "#FA5400"],
    "content_pillars": [
      "Athlete stories (real athletes, real journeys)",
      "Product innovation (tech-forward, performance proof)",
      "Cultural moments (sport meets music, art, fashion)",
      "Community (amateur athletes, grassroots sport)"
    ],
    "posts_per_week": 14,
    "avoid": ["Passive voice", "Generic lifestyle shots with no sport context", "Overproduced CGI that feels disconnected from real sweat"]
  }',
  '["@adidas", "@underarmour", "@puma", "@newbalance", "@asics"]',
  false
)
ON CONFLICT (id) DO NOTHING;

-- Seed competitor snapshots for Nike
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'competitor_snapshots'
  ) THEN
    INSERT INTO public.competitor_snapshots (
      id, client_id, competitor_handle, platform, followers, avg_er, posting_frequency, growth_signal, scraped_at
    )
    VALUES
      (gen_random_uuid(), 'a1b2c3d4-e5f6-7890-abcd-ef0987654321', '@adidas',       'Instagram', 31000000, 0.8, 10, 'stable',       now()),
      (gen_random_uuid(), 'a1b2c3d4-e5f6-7890-abcd-ef0987654321', '@newbalance',   'Instagram', 9200000,  2.1, 7,  'accelerating', now()),
      (gen_random_uuid(), 'a1b2c3d4-e5f6-7890-abcd-ef0987654321', '@puma',         'Instagram', 14000000, 1.2, 8,  'stable',       now())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
