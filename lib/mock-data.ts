import type {
  User, Client, Project, Task, ScheduledPost,
  ModerationItem, Asset, DashboardStats
} from './types'

export const USERS: User[] = [
  { id: 'u1', name: 'Sarah Al-Mansouri', email: 'sarah@agency.com', role: 'creative_director', department: 'creative', initials: 'SA', color: '#6366f1' },
  { id: 'u2', name: 'Omar Hassan', email: 'omar@agency.com', role: 'copywriter', department: 'creative', initials: 'OH', color: '#f59e0b' },
  { id: 'u3', name: 'Lena Müller', email: 'lena@agency.com', role: 'designer', department: 'creative', initials: 'LM', color: '#10b981' },
  { id: 'u4', name: 'Karim Benali', email: 'karim@agency.com', role: 'social_manager', department: 'social', initials: 'KB', color: '#f43f5e' },
  { id: 'u5', name: 'Yara Ibrahim', email: 'yara@agency.com', role: 'account_manager', department: 'accounts', initials: 'YI', color: '#8b5cf6' },
  { id: 'u6', name: 'James Chen', email: 'james@agency.com', role: 'strategist', department: 'strategy', initials: 'JC', color: '#0ea5e9' },
]

export const CLIENTS: Client[] = [
  {
    id: 'c1', name: 'Luxe Cosmetics', initials: 'LC', color: '#e11d48', status: 'active',
    brand_identity: {
      primary_color: '#1a1a2e', secondary_color: '#e11d48', tone_of_voice: 'Elegant, aspirational, empowering',
      target_audience: 'Women 25–45, premium beauty enthusiasts', industry: 'Beauty & Cosmetics',
      key_messages: ['Luxury for every skin', 'Science meets beauty', 'Cruelty-free excellence'],
    },
    competitor_context: ['Charlotte Tilbury', 'NARS', 'Estée Lauder'],
    reference_links: ['https://luxecosmetics.com'], metricool_blog_id: 'mc_luxe_01',
    respond_io_channel_id: 'rio_luxe_01', created_at: '2024-01-15',
  },
  {
    id: 'c2', name: 'TechNova Solutions', initials: 'TN', color: '#0ea5e9', status: 'active',
    brand_identity: {
      primary_color: '#0f172a', secondary_color: '#0ea5e9', tone_of_voice: 'Authoritative, innovative, clear',
      target_audience: 'B2B decision makers, CTOs, IT managers', industry: 'B2B SaaS',
      key_messages: ['Automate to accelerate', 'Enterprise-grade security', 'Scale without limits'],
    },
    competitor_context: ['Salesforce', 'HubSpot', 'Monday.com'],
    reference_links: ['https://technova.io'], metricool_blog_id: 'mc_tn_02',
    respond_io_channel_id: 'rio_tn_02', created_at: '2024-02-20',
  },
  {
    id: 'c3', name: 'Coastal Eats', initials: 'CE', color: '#f97316', status: 'active',
    brand_identity: {
      primary_color: '#1e3a5f', secondary_color: '#f97316', tone_of_voice: 'Warm, playful, fresh',
      target_audience: 'Families & foodies 22–45, local community', industry: 'Food & Beverage',
      key_messages: ['Fresh from the coast', 'Family recipes, modern flavors', 'Every meal is a memory'],
    },
    competitor_context: ['The Kite & Anchor', 'Blue Crab Bistro'],
    reference_links: ['https://coastaleats.com'], metricool_blog_id: 'mc_ce_03',
    respond_io_channel_id: 'rio_ce_03', created_at: '2024-03-10',
  },
  {
    id: 'c4', name: 'FitForge', initials: 'FF', color: '#10b981', status: 'active',
    brand_identity: {
      primary_color: '#064e3b', secondary_color: '#10b981', tone_of_voice: 'Motivational, direct, energetic',
      target_audience: 'Fitness enthusiasts 18–35, gym-goers', industry: 'Health & Fitness',
      key_messages: ['Forge your best self', 'No excuses, only results', 'Built by athletes, for athletes'],
    },
    competitor_context: ['Gymshark', 'Myprotein', 'Under Armour'],
    reference_links: ['https://fitforge.com'], metricool_blog_id: 'mc_ff_04',
    respond_io_channel_id: 'rio_ff_04', created_at: '2024-04-05',
  },
]

export const PROJECTS: Project[] = [
  {
    id: 'p1', client_id: 'c1', name: 'Q2 Ramadan Campaign', status: 'active',
    start_date: '2025-03-01', end_date: '2025-04-10',
    quarter_strategy: { goals: ['20% reach increase', 'Launch new product line'], themes: ['Ramadan gifting', 'Self-care rituals'], kpis: ['Reach 500K', 'ER > 4%', '200 story mentions'] },
    created_at: '2025-02-15',
  },
  {
    id: 'p2', client_id: 'c1', name: 'Summer Glow Collection', status: 'active',
    start_date: '2025-04-15', end_date: '2025-06-30',
    quarter_strategy: { goals: ['Product launch awareness', 'Drive DTC sales'], themes: ['Summer radiance', 'Minimalist beauty'], kpis: ['100K product page clicks', 'ER > 5%'] },
    created_at: '2025-03-20',
  },
  {
    id: 'p3', client_id: 'c2', name: 'LinkedIn Authority Build', status: 'active',
    start_date: '2025-01-01', end_date: '2025-06-30',
    quarter_strategy: { goals: ['Establish thought leadership', '500 new followers/month'], themes: ['AI in enterprise', 'Digital transformation'], kpis: ['Impressions 250K/mo', '50 qualified leads'] },
    created_at: '2024-12-10',
  },
  {
    id: 'p4', client_id: 'c3', name: 'Summer Menu Launch', status: 'active',
    start_date: '2025-05-01', end_date: '2025-07-31',
    quarter_strategy: { goals: ['Drive foot traffic', 'Boost online orders 30%'], themes: ['Fresh summer flavors', 'Family dining'], kpis: ['5K reservation clicks', '10K story views'] },
    created_at: '2025-04-01',
  },
  {
    id: 'p5', client_id: 'c4', name: 'Eid Fitness Challenge', status: 'active',
    start_date: '2025-03-20', end_date: '2025-04-20',
    quarter_strategy: { goals: ['Community engagement', 'App downloads +40%'], themes: ['Ramadan wellness', 'Post-Eid transformation'], kpis: ['UGC 500 posts', 'App downloads 2K'] },
    created_at: '2025-03-01',
  },
]

export const TASKS: Task[] = [
  // Strategy
  { id: 't1', project_id: 'p1', client_id: 'c1', assigned_to: 'u6', title: 'Q2 Brand Strategy Document', description: 'Define quarterly content pillars, messaging hierarchy, and KPI targets for Luxe Q2 campaign.', pipeline_stage: 'strategy', priority: 'high', status: 'active', due_date: '2025-05-05', created_at: '2025-04-20', updated_at: '2025-04-28', tags: ['strategy', 'q2', 'luxe'] },
  { id: 't2', project_id: 'p3', client_id: 'c2', assigned_to: 'u6', title: 'TechNova LinkedIn Strategy', description: 'Map out 3-month content cadence for LinkedIn authority building. Include competitor gap analysis.', pipeline_stage: 'strategy', priority: 'medium', status: 'active', due_date: '2025-05-08', created_at: '2025-04-22', updated_at: '2025-04-25', tags: ['linkedin', 'b2b', 'strategy'] },

  // Ideas
  { id: 't3', project_id: 'p2', client_id: 'c1', assigned_to: 'u2', title: 'Summer Glow Content Ideas', description: 'Brainstorm 30 content ideas for the Summer Glow Collection launch across Instagram and TikTok.', pipeline_stage: 'ideas', priority: 'high', status: 'active', due_date: '2025-05-06', created_at: '2025-04-25', updated_at: '2025-04-29', tags: ['ideas', 'summer', 'instagram'] },
  { id: 't4', project_id: 'p4', client_id: 'c3', assigned_to: 'u2', title: 'Summer Menu Campaign Concepts', description: 'Generate creative concepts for the new summer menu reveal. Focus on food photography directions.', pipeline_stage: 'ideas', priority: 'medium', status: 'active', due_date: '2025-05-10', created_at: '2025-04-26', updated_at: '2025-04-26', tags: ['food', 'creative', 'summer'] },

  // Calendar
  { id: 't5', project_id: 'p1', client_id: 'c1', assigned_to: 'u4', title: 'Luxe May Content Calendar', description: 'Build the full May posting schedule with dates, times, formats, and copy placeholders for all platforms.', pipeline_stage: 'calendar', priority: 'urgent', status: 'active', due_date: '2025-05-02', created_at: '2025-04-24', updated_at: '2025-04-30', tags: ['calendar', 'scheduling', 'luxe'] },
  { id: 't6', project_id: 'p5', client_id: 'c4', assigned_to: 'u4', title: 'FitForge May Calendar', description: 'Schedule FitForge challenge posts, progress updates, and product highlights for May.', pipeline_stage: 'calendar', priority: 'high', status: 'active', due_date: '2025-05-03', created_at: '2025-04-26', updated_at: '2025-04-28', tags: ['calendar', 'fitforge'] },

  // Copy
  { id: 't7', project_id: 'p2', client_id: 'c1', assigned_to: 'u2', title: 'Summer Glow Instagram Captions', description: 'Write 12 Instagram captions for the Summer Glow launch week. Tone: elegant, aspirational. CTA: Shop now.', pipeline_stage: 'copy', priority: 'high', status: 'active', due_date: '2025-05-07', created_at: '2025-04-28', updated_at: '2025-05-01', tags: ['copy', 'instagram', 'captions'] },
  { id: 't8', project_id: 'p3', client_id: 'c2', assigned_to: 'u2', title: 'TechNova LinkedIn Articles', description: 'Write 2 long-form LinkedIn articles on AI adoption in enterprise. 800 words each, data-backed.', pipeline_stage: 'copy', priority: 'medium', status: 'active', due_date: '2025-05-12', created_at: '2025-04-29', updated_at: '2025-04-29', tags: ['linkedin', 'article', 'b2b'] },
  { id: 't9', project_id: 'p4', client_id: 'c3', assigned_to: 'u2', title: 'Coastal Eats Menu Post Copy', description: 'Write 8 posts introducing new summer dishes. Playful, fresh tone. Include emojis and hashtag sets.', pipeline_stage: 'copy', priority: 'medium', status: 'active', due_date: '2025-05-09', created_at: '2025-04-27', updated_at: '2025-04-30', tags: ['copy', 'food', 'instagram'] },

  // Design
  { id: 't10', project_id: 'p2', client_id: 'c1', assigned_to: 'u3', title: 'Summer Glow Visual Assets', description: 'Design 15 social media visuals for Summer Glow. Include feed posts, stories, and Reels covers.', pipeline_stage: 'design', priority: 'urgent', status: 'active', due_date: '2025-05-08', created_at: '2025-04-29', updated_at: '2025-05-01', tags: ['design', 'assets', 'luxe'] },
  { id: 't11', project_id: 'p5', client_id: 'c4', assigned_to: 'u3', title: 'FitForge Challenge Graphics', description: 'Create challenge progress tracker, before/after template, and daily motivation quote cards.', pipeline_stage: 'design', priority: 'high', status: 'active', due_date: '2025-05-06', created_at: '2025-04-28', updated_at: '2025-04-30', tags: ['design', 'fitness', 'ugc'] },

  // Review
  { id: 't12', project_id: 'p1', client_id: 'c1', assigned_to: 'u1', title: 'Luxe April Campaign Review', description: 'Review all April campaign deliverables against brief. Check brand compliance, messaging accuracy.', pipeline_stage: 'review', priority: 'high', status: 'active', due_date: '2025-05-03', created_at: '2025-04-25', updated_at: '2025-05-01', tags: ['review', 'qa', 'luxe'] },
  { id: 't13', project_id: 'p3', client_id: 'c2', assigned_to: 'u5', title: 'TechNova Content Review', description: 'Internal QA on LinkedIn content batch. Verify tech accuracy, tone, and CTA clarity.', pipeline_stage: 'review', priority: 'medium', status: 'active', due_date: '2025-05-05', created_at: '2025-04-26', updated_at: '2025-04-29', tags: ['review', 'linkedin', 'b2b'] },

  // Approval
  { id: 't14', project_id: 'p4', client_id: 'c3', assigned_to: 'u5', title: 'Coastal Eats May Posts — Client Approval', description: 'Send full May content batch to client for sign-off. Requires approval by May 3rd to meet schedule.', pipeline_stage: 'approval', priority: 'urgent', status: 'active', due_date: '2025-05-03', created_at: '2025-04-28', updated_at: '2025-05-01', tags: ['approval', 'client', 'coastal'] },
  { id: 't15', project_id: 'p5', client_id: 'c4', assigned_to: 'u5', title: 'FitForge Challenge Posts Approval', description: 'FitForge CEO to approve all challenge visuals and copy before scheduling begins.', pipeline_stage: 'approval', priority: 'high', status: 'active', due_date: '2025-05-04', created_at: '2025-04-29', updated_at: '2025-05-01', tags: ['approval', 'fitforge'] },

  // Scheduled
  { id: 't16', project_id: 'p1', client_id: 'c1', assigned_to: 'u4', title: 'Luxe Week 1 Posts — Scheduled', description: '6 posts scheduled for May 5–11. Metricool confirmed. Monitor for platform errors.', pipeline_stage: 'scheduled', priority: 'medium', status: 'active', due_date: '2025-05-11', created_at: '2025-04-30', updated_at: '2025-05-01', tags: ['scheduled', 'luxe', 'instagram'] },
  { id: 't17', project_id: 'p3', client_id: 'c2', assigned_to: 'u4', title: 'TechNova Week 1 LinkedIn', description: '3 LinkedIn posts scheduled Mon/Wed/Fri. Articles queued for newsletter.', pipeline_stage: 'scheduled', priority: 'low', status: 'active', due_date: '2025-05-09', created_at: '2025-04-30', updated_at: '2025-05-01', tags: ['scheduled', 'linkedin'] },

  // Published
  { id: 't18', project_id: 'p1', client_id: 'c1', assigned_to: 'u4', title: 'Luxe April Product Drop Posts', description: 'All 12 April product drop posts published. Engagement tracking active.', pipeline_stage: 'published', priority: 'low', status: 'completed', due_date: '2025-04-28', created_at: '2025-04-10', updated_at: '2025-04-28', tags: ['published', 'luxe'] },
  { id: 't19', project_id: 'p5', client_id: 'c4', assigned_to: 'u4', title: 'FitForge Challenge Kickoff Posts', description: 'Launch posts published across IG, TikTok, and FB. Challenge hashtag trending locally.', pipeline_stage: 'published', priority: 'low', status: 'completed', due_date: '2025-04-22', created_at: '2025-04-15', updated_at: '2025-04-22', tags: ['published', 'challenge', 'ugc'] },

  // Reporting
  { id: 't20', project_id: 'p1', client_id: 'c1', assigned_to: 'u5', title: 'Luxe April Monthly Report', description: 'Generate April performance report with reach, engagement, and growth metrics for client delivery.', pipeline_stage: 'reporting', priority: 'medium', status: 'active', due_date: '2025-05-05', created_at: '2025-04-29', updated_at: '2025-05-01', tags: ['report', 'monthly', 'luxe'] },
  { id: 't21', project_id: 'p5', client_id: 'c4', assigned_to: 'u5', title: 'FitForge Challenge Mid-Report', description: 'Mid-challenge performance snapshot. UGC count, reach, app download tracking.', pipeline_stage: 'reporting', priority: 'medium', status: 'active', due_date: '2025-05-06', created_at: '2025-04-30', updated_at: '2025-05-01', tags: ['report', 'challenge', 'fitforge'] },
]

export const SCHEDULED_POSTS: ScheduledPost[] = [
  { id: 'sp1', task_id: 't16', client_id: 'c1', platforms: ['instagram', 'facebook'], caption: 'Summer is calling and your skin deserves the glow. Introducing our Summer Glow Collection — 8 shades, zero limits. Shop now via link in bio.', media_url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800', scheduled_at: '2026-05-05T09:00:00', status: 'scheduled' },
  { id: 'sp2', task_id: 't16', client_id: 'c1', platforms: ['instagram'], caption: 'Behind the formula: our scientists spent 18 months perfecting the Summer Glow tinted serum. The result? SPF 30, buildable coverage, and that second-skin finish.', media_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800', scheduled_at: '2026-05-07T11:00:00', status: 'scheduled' },
  { id: 'sp3', task_id: 't17', client_id: 'c2', platforms: ['linkedin'], caption: '73% of enterprise leaders say their biggest bottleneck is process. Here\'s how TechNova\'s workflow automation suite cut deployment time by 60% for a Fortune 500 client.', scheduled_at: '2026-05-05T08:00:00', status: 'scheduled' },
  { id: 'sp4', task_id: 't17', client_id: 'c2', platforms: ['linkedin'], caption: 'Hot take: your CRM should do MORE than store contacts. In 2026, it should predict churn, surface opportunities, and automate follow-ups before your rep opens their laptop.', scheduled_at: '2026-05-12T08:30:00', status: 'scheduled' },
  { id: 'sp5', task_id: 't18', client_id: 'c1', platforms: ['instagram', 'facebook', 'tiktok'], caption: 'Meet VELVET NOIR — our boldest lipstick yet. 16-hour wear, zero transfer, maximum drama. Tag someone who needs this in their life.', media_url: 'https://images.unsplash.com/photo-1586495777744-4e6232bf2847?w=800', scheduled_at: '2026-04-22T10:00:00', status: 'published', published_at: '2026-04-22T10:00:00', performance: { reach: 48200, impressions: 71500, engagement_rate: 6.2, likes: 2890, comments: 234, shares: 187, saves: 634 } },
  { id: 'sp6', task_id: 't19', client_id: 'c4', platforms: ['instagram', 'tiktok', 'facebook'], caption: 'THE 30-DAY FITFORGE CHALLENGE IS HERE. Your mission: show up, log your workouts, post your progress with #FitForge30. Top 3 transformations win a year of FitForge Pro.', scheduled_at: '2026-04-15T07:00:00', status: 'published', published_at: '2026-04-15T07:00:00', performance: { reach: 92400, impressions: 143000, engagement_rate: 8.7, likes: 7823, comments: 1240, shares: 2100, saves: 891 } },
  { id: 'sp7', task_id: 't16', client_id: 'c1', platforms: ['instagram'], caption: 'Skincare that works as hard as you do. Our new Summer Glow Moisturiser — lightweight, SPF 20, and that dewy look without the grease. Morning routine sorted.', media_url: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800', scheduled_at: '2026-05-14T10:00:00', status: 'draft' },
  { id: 'sp8', task_id: 't17', client_id: 'c2', platforms: ['linkedin'], caption: 'We just published our 2026 Enterprise AI Readiness Report — 800 companies surveyed, 47 data points. Companies that integrate AI into ops see 3.2x faster revenue growth.', scheduled_at: '2026-05-19T09:00:00', status: 'draft' },
  { id: 'sp9', task_id: 't18', client_id: 'c3', platforms: ['instagram', 'facebook'], caption: 'Fresh off the grill and straight to your table. Our new summer menu is here — coastal flavours, local ingredients, and a view you won\'t forget.', media_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800', scheduled_at: '2026-05-08T12:00:00', status: 'scheduled' },
  { id: 'sp10', task_id: 't19', client_id: 'c4', platforms: ['instagram', 'tiktok'], caption: 'Week 3 check-in. Our challenge community is 14,000 strong and the transformations are already unreal. Share your progress — we\'re featuring the best ones.', scheduled_at: '2026-05-15T07:00:00', status: 'scheduled' },
  { id: 'sp11', task_id: 't17', client_id: 'c2', platforms: ['linkedin'], caption: 'TechNova Q1 2026 results: 34% revenue growth, 98.7% uptime, 200+ enterprise clients onboarded. The platform scales with you — read the full highlights below.', scheduled_at: '2026-05-21T09:00:00', status: 'scheduled' },
  { id: 'sp12', task_id: 't16', client_id: 'c1', platforms: ['instagram'], caption: 'New drop alert: our limited edition Rose Quartz eyeshadow palette. 12 shades, two finishes, one palette you\'ll reach for every day this summer.', media_url: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800', scheduled_at: '2026-05-26T10:00:00', status: 'scheduled' },
]

export const MODERATION_ITEMS: ModerationItem[] = [
  { id: 'm1', client_id: 'c1', platform: 'instagram', commenter_name: 'Noura Al-Sayed', commenter_handle: '@noura_beauty', comment_text: 'Does the Summer Glow serum work on sensitive skin? I have rosacea and I\'m scared to try new products 😢', post_caption: 'Behind the formula: our scientists spent 18 months...', ai_suggested_reply: 'Hi Noura! ✨ We totally understand your concern. Our Summer Glow Serum is fragrance-free, dermatologist-tested, and suitable for sensitive skin — including rosacea-prone skin. We always recommend doing a patch test first. DM us and we\'ll send you more ingredient details! 💕', status: 'pending', created_at: '2025-05-01T10:32:00' },
  { id: 'm2', client_id: 'c1', platform: 'instagram', commenter_name: 'Dina Khouri', commenter_handle: '@dina.glam', comment_text: 'I ordered 2 weeks ago and still haven\'t received my package. No response from customer service either 😡', post_caption: '✨ Summer is calling and your skin deserves the glow...', ai_suggested_reply: 'Hi Dina, we\'re so sorry to hear this! This is not the experience we want for you. Please DM us your order number right away and we\'ll personally escalate this to our fulfilment team. We\'ll make it right. 🙏', status: 'pending', created_at: '2025-05-01T11:45:00' },
  { id: 'm3', client_id: 'c4', platform: 'instagram', commenter_name: 'Ahmed Saleh', commenter_handle: '@ahmed_lifts', comment_text: 'Joined the challenge! Day 3 done 💪 loving the app, the workout tracking is insane', post_caption: '🔥 THE 30-DAY FITFORGE CHALLENGE IS HERE...', ai_suggested_reply: 'Let\'s GO Ahmed! 🔥 Day 3 already — you\'re on fire! Keep posting your progress with #FitForge30 and tag us. We\'re watching every single one. 💪', status: 'replied', final_reply: 'Let\'s GO Ahmed! 🔥 Day 3 already — you\'re on fire! Keep posting your progress with #FitForge30 and tag us. We\'re watching every single one. 💪', created_at: '2025-04-16T09:15:00' },
  { id: 'm4', client_id: 'c3', platform: 'facebook', commenter_name: 'Maria Santos', commenter_handle: 'Maria Santos', comment_text: 'Do you have gluten-free options on the new summer menu? My daughter has celiac disease', post_caption: 'Fresh from the coast — our summer menu is here!', ai_suggested_reply: 'Hi Maria! Great news — we have several gluten-free options on our new summer menu, including our Grilled Mahi-Mahi Bowl and the Coastal Ceviche. Our kitchen team is also trained on cross-contamination protocols. We\'d recommend letting your server know when you arrive so we can take extra care. See you soon! 🌊', status: 'pending', created_at: '2025-05-01T14:20:00' },
  { id: 'm5', client_id: 'c2', platform: 'linkedin', commenter_name: 'Rami Al-Farsi', commenter_handle: 'Rami Al-Farsi', comment_text: 'Great post! We\'re evaluating CRM solutions right now. Would love to schedule a demo.', post_caption: 'Hot take: your CRM should do MORE than store contacts...', ai_suggested_reply: 'Thanks Rami — perfect timing! We\'d love to show you what TechNova can do for your team. I\'ll send you a direct message to coordinate a demo at your convenience. Looking forward to connecting!', status: 'pending', created_at: '2025-05-01T16:05:00' },
]

export const ASSETS: Asset[] = [
  { id: 'a1', task_id: 't10', source: 'upload', type: 'image', file_url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800', thumbnail_url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=300', license_info: 'Client-provided', title: 'Luxury cosmetics flat lay', created_at: '2025-04-30' },
  { id: 'a2', task_id: 't10', source: 'upload', type: 'image', file_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800', thumbnail_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=300', license_info: 'Client-provided', title: 'Beauty product skincare', created_at: '2025-04-30' },
  { id: 'a3', task_id: 't11', source: 'drive', type: 'image', file_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800', thumbnail_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300', license_info: 'Google Drive', title: 'Fitness workout gym', created_at: '2025-04-29' },
  { id: 'a4', task_id: 't9', source: 'drive', type: 'image', file_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800', thumbnail_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300', license_info: 'Google Drive', title: 'Fresh seafood coastal dish', created_at: '2025-04-28' },
  { id: 'a5', task_id: 't7', source: 'upload', type: 'image', file_url: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800', thumbnail_url: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=300', license_info: 'Client-provided', title: 'Summer Glow product shot', created_at: '2025-04-27' },
]

export const DASHBOARD_STATS: DashboardStats = {
  active_tasks: 18,
  due_today: 3,
  pending_approvals: 2,
  pending_moderation: 3,
  ai_cost_month: 58.40,
  posts_scheduled: 12,
  posts_published: 47,
  pipeline_velocity: 4.2,
}

export const getClientById = (id: string) => CLIENTS.find(c => c.id === id)
export const getProjectById = (id: string) => PROJECTS.find(p => p.id === id)
export const getUserById = (id: string) => USERS.find(u => u.id === id)
export const getTasksByStage = (stage: string) => TASKS.filter(t => t.pipeline_stage === stage)
export const getTasksByClient = (clientId: string) => TASKS.filter(t => t.client_id === clientId)
export const getPostsByClient = (clientId: string) => SCHEDULED_POSTS.filter(p => p.client_id === clientId)
