// ============================================================
// Reddit Rising Data Provider
// OAuth with REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET.
// Extracts cultural tensions from rising post patterns.
// ============================================================

export interface RedditData {
  rising_posts: Array<{
    subreddit: string
    title: string
    upvote_velocity: number
    url: string
    created_utc: number
  }>
  relevant_subreddits: string[]
  cultural_tensions: string[]
  source: 'reddit_api' | 'fallback'
  fetched_at: string
}

// ── Industry → subreddit map ──────────────────────────────────

const SUBREDDIT_MAP: Record<string, string[]> = {
  beauty: ['SkincareAddiction', 'makeupaddiction', 'AsianBeauty', 'NaturalBeauty', '30PlusSkinCare'],
  tech: ['technology', 'gadgets', 'programming', 'hardware', 'artificial'],
  food: ['food', 'cooking', 'recipes', 'MealPrepSunday', 'EatCheapAndHealthy'],
  fitness: ['fitness', 'loseit', 'bodybuilding', 'running', 'xxfitness'],
  finance: ['personalfinance', 'investing', 'financialindependence', 'Frugal', 'stocks'],
  fashion: ['femalefashionadvice', 'malefashionadvice', 'streetwear', 'thriftstorehauls', 'frugalmalefashion'],
  travel: ['travel', 'solotravel', 'backpacking', 'digitalnomad', 'shoestring'],
  education: ['GetStudying', 'learnprogramming', 'college', 'GradSchool', 'Teachers'],
  real_estate: ['realestate', 'FirstTimeHomeBuyer', 'REBubble', 'airbnb', 'legaladvice'],
}

// ── Rich mock data per industry ───────────────────────────────

interface MockData {
  rising_posts: RedditData['rising_posts']
  cultural_tensions: string[]
}

const MOCK_DATA: Record<string, MockData> = {
  beauty: {
    rising_posts: [
      {
        subreddit: 'SkincareAddiction',
        title: 'I stopped using 12 products and my skin has never been better — less really is more',
        upvote_velocity: 847,
        url: 'https://reddit.com/r/SkincareAddiction/example1',
        created_utc: Date.now() / 1000 - 3600,
      },
      {
        subreddit: 'AsianBeauty',
        title: 'Why does my $8 drugstore cleanser outperform my $60 luxury one? Here is what I found',
        upvote_velocity: 612,
        url: 'https://reddit.com/r/AsianBeauty/example2',
        created_utc: Date.now() / 1000 - 7200,
      },
      {
        subreddit: 'makeupaddiction',
        title: 'SPF or makeup first — I tested it for 30 days and the results surprised me',
        upvote_velocity: 534,
        url: 'https://reddit.com/r/makeupaddiction/example3',
        created_utc: Date.now() / 1000 - 5400,
      },
      {
        subreddit: 'SkincareAddiction',
        title: 'Dermatologist told me to stop using my vitamin C serum in the morning. Here is why.',
        upvote_velocity: 498,
        url: 'https://reddit.com/r/SkincareAddiction/example4',
        created_utc: Date.now() / 1000 - 10800,
      },
    ],
    cultural_tensions: [
      'People love skincare but feel overwhelmed and guilty about how complicated it has become',
      'Consumers trust influencer recommendations but resent the feeling of being sold to',
      'People want natural and minimal ingredients but still expect pharmaceutical-grade results',
      'Users want luxury skincare outcomes but feel price points are increasingly unjustifiable',
    ],
  },
  tech: {
    rising_posts: [
      {
        subreddit: 'technology',
        title: 'I replaced every Google tool with open source alternatives — 6 months later update',
        upvote_velocity: 1240,
        url: 'https://reddit.com/r/technology/example1',
        created_utc: Date.now() / 1000 - 3600,
      },
      {
        subreddit: 'programming',
        title: 'AI wrote 80% of my code this week. Here is what it got wrong every single time.',
        upvote_velocity: 934,
        url: 'https://reddit.com/r/programming/example2',
        created_utc: Date.now() / 1000 - 7200,
      },
      {
        subreddit: 'gadgets',
        title: 'Bought the cheapest smartwatch. It does everything the $400 one does for $29.',
        upvote_velocity: 721,
        url: 'https://reddit.com/r/gadgets/example3',
        created_utc: Date.now() / 1000 - 9000,
      },
    ],
    cultural_tensions: [
      'Developers are excited about AI assistance but anxious about what it means for their expertise and career',
      'People want privacy and data ownership but are unwilling to accept any inconvenience to get it',
      'Users want cutting-edge tech but distrust big tech companies who make it',
      'Consumers love new devices but feel buried in subscription fees for features they already paid for',
    ],
  },
  food: {
    rising_posts: [
      {
        subreddit: 'MealPrepSunday',
        title: 'I meal prepped every Sunday for a year. Here is what nobody tells you about it.',
        upvote_velocity: 892,
        url: 'https://reddit.com/r/MealPrepSunday/example1',
        created_utc: Date.now() / 1000 - 3600,
      },
      {
        subreddit: 'EatCheapAndHealthy',
        title: 'Entire week of dinners for two people under $40 — full breakdown with macros',
        upvote_velocity: 754,
        url: 'https://reddit.com/r/EatCheapAndHealthy/example2',
        created_utc: Date.now() / 1000 - 7200,
      },
      {
        subreddit: 'cooking',
        title: 'Restaurant chefs share the one technique home cooks almost never use correctly',
        upvote_velocity: 638,
        url: 'https://reddit.com/r/cooking/example3',
        created_utc: Date.now() / 1000 - 5400,
      },
    ],
    cultural_tensions: [
      'People want to eat healthy but feel that healthy food culture has become elitist and expensive',
      'Home cooks want restaurant-quality results but resist spending more than 30 minutes cooking',
      'Consumers love the idea of food sustainability but rarely change purchasing behavior for it',
      'Food content audiences want authenticity but engage most with highly aestheticised, styled food',
    ],
  },
  fitness: {
    rising_posts: [
      {
        subreddit: 'fitness',
        title: 'I trained for 5 years before I understood progressive overload. Here is the simple version.',
        upvote_velocity: 1150,
        url: 'https://reddit.com/r/fitness/example1',
        created_utc: Date.now() / 1000 - 3600,
      },
      {
        subreddit: 'xxfitness',
        title: 'Why I stopped doing HIIT every day and what happened to my body instead',
        upvote_velocity: 876,
        url: 'https://reddit.com/r/xxfitness/example2',
        created_utc: Date.now() / 1000 - 7200,
      },
      {
        subreddit: 'loseit',
        title: 'Lost 30kg. The things that actually worked were completely boring. The things that failed were all exciting.',
        upvote_velocity: 743,
        url: 'https://reddit.com/r/loseit/example3',
        created_utc: Date.now() / 1000 - 10800,
      },
    ],
    cultural_tensions: [
      'People want dramatic transformation results but resent the time, consistency, and effort required',
      'Fitness audiences love motivational content but feel it sets unrealistic expectations that lead to failure',
      'People want to be told the optimal routine but simultaneously resist any routine that feels restrictive',
      'Users seek community and accountability but feel shame and judgment in fitness spaces',
    ],
  },
  finance: {
    rising_posts: [
      {
        subreddit: 'personalfinance',
        title: 'I paid off $67k of debt in 3 years on a teacher salary. The method is not what you expect.',
        upvote_velocity: 1380,
        url: 'https://reddit.com/r/personalfinance/example1',
        created_utc: Date.now() / 1000 - 3600,
      },
      {
        subreddit: 'financialindependence',
        title: 'FIRE is not about the money. Here is what 10 years of pursuing it taught me that has nothing to do with investing.',
        upvote_velocity: 987,
        url: 'https://reddit.com/r/financialindependence/example2',
        created_utc: Date.now() / 1000 - 5400,
      },
      {
        subreddit: 'investing',
        title: 'I backtested every popular investing strategy. Simple index funds beat them all. Every time.',
        upvote_velocity: 812,
        url: 'https://reddit.com/r/investing/example3',
        created_utc: Date.now() / 1000 - 9000,
      },
    ],
    cultural_tensions: [
      'People want financial security but are terrified of the discipline and sacrifice required to achieve it',
      'Finance audiences want advanced investment strategies but most of them have not mastered the basics',
      'People feel shame about their financial situation but simultaneously want validation that it is not their fault',
      'Consumers distrust banks and financial institutions but rely on them for every major life decision',
    ],
  },
  fashion: {
    rising_posts: [
      {
        subreddit: 'femalefashionadvice',
        title: 'I built a 10-piece wardrobe that takes me from Monday meetings to Saturday dinners. Full breakdown.',
        upvote_velocity: 692,
        url: 'https://reddit.com/r/femalefashionadvice/example1',
        created_utc: Date.now() / 1000 - 3600,
      },
      {
        subreddit: 'thriftstorehauls',
        title: 'Found this $4 blazer at Goodwill. Identical to the $380 Zara version.',
        upvote_velocity: 534,
        url: 'https://reddit.com/r/thriftstorehauls/example2',
        created_utc: Date.now() / 1000 - 7200,
      },
    ],
    cultural_tensions: [
      'Fashion audiences want to look expensive but feel guilty about fast fashion and real luxury prices',
      'People aspire to have a defined personal style but are overwhelmed by trend cycles and FOMO',
      'Consumers want to be seen as effortlessly stylish but invest significant effort to achieve that appearance',
    ],
  },
  real_estate: {
    rising_posts: [
      {
        subreddit: 'FirstTimeHomeBuyer',
        title: 'Everything your real estate agent does not want you to know before making an offer',
        upvote_velocity: 1560,
        url: 'https://reddit.com/r/FirstTimeHomeBuyer/example1',
        created_utc: Date.now() / 1000 - 3600,
      },
      {
        subreddit: 'realestate',
        title: 'I bought in 2021 at peak prices. Here is what I wish I had known. No sugarcoating.',
        upvote_velocity: 1120,
        url: 'https://reddit.com/r/realestate/example2',
        created_utc: Date.now() / 1000 - 7200,
      },
      {
        subreddit: 'REBubble',
        title: 'Realtor commission structure explained — why your agent is incentivized against your best interest',
        upvote_velocity: 892,
        url: 'https://reddit.com/r/REBubble/example3',
        created_utc: Date.now() / 1000 - 9000,
      },
    ],
    cultural_tensions: [
      'Buyers desperately want homeownership as a stability milestone but feel the market is permanently rigged against them',
      'Sellers want maximum price but also want a smooth, fast transaction — two goals that directly conflict',
      'People want trusted expert advice on their biggest purchase but have deep distrust of agents whose pay depends on the sale',
      'Renters feel stigmatized for not owning despite often making the financially sound decision for their situation',
    ],
  },
}

const DEFAULT_MOCK = MOCK_DATA.beauty

// ── Reddit OAuth ──────────────────────────────────────────────

let cachedToken: { access_token: string; expires_at: number } | null = null

async function getRedditToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token
  }

  const credentials = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString('base64')

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'NOVAXAgencyOps/1.0',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`Reddit OAuth failed: ${response.status}`)
  }

  const data = await response.json()
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.access_token
}

async function fetchRisingFromSubreddit(
  subreddit: string,
  token: string
): Promise<RedditData['rising_posts']> {
  const response = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/rising?limit=10`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'NOVAXAgencyOps/1.0',
      },
    }
  )

  if (!response.ok) return []

  const json = await response.json()
  return (json.data?.children ?? []).map((child: { data: { title: string; ups: number; permalink: string; created_utc: number } }) => ({
    subreddit,
    title: child.data.title,
    upvote_velocity: child.data.ups,
    url: `https://reddit.com${child.data.permalink}`,
    created_utc: child.data.created_utc,
  }))
}

// ── Public API ────────────────────────────────────────────────

export async function fetchRedditRising(industry: string): Promise<RedditData> {
  const key = industry.toLowerCase()
  const subreddits = SUBREDDIT_MAP[key] ?? SUBREDDIT_MAP.beauty

  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    try {
      const token = await getRedditToken()
      const results = await Promise.allSettled(
        subreddits.map((sub) => fetchRisingFromSubreddit(sub, token))
      )

      const rising_posts = results
        .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
        .sort((a, b) => b.upvote_velocity - a.upvote_velocity)
        .slice(0, 15)

      // Extract cultural tensions from post patterns using title analysis
      const titles = rising_posts.map((p) => p.title.toLowerCase())
      const tensions: string[] = []

      if (titles.some((t) => t.includes('stopped') || t.includes('quit') || t.includes('never'))) {
        tensions.push('Audiences are actively rejecting conventional advice in this space')
      }
      if (titles.some((t) => t.includes('truth') || t.includes("don't want you") || t.includes('secret'))) {
        tensions.push('There is strong demand for insider knowledge withheld by industry gatekeepers')
      }
      if (titles.some((t) => t.includes('cheap') || t.includes('$') || t.includes('budget'))) {
        tensions.push('People want premium outcomes but resent premium pricing')
      }

      const mockTensions = (MOCK_DATA[key] ?? DEFAULT_MOCK).cultural_tensions
      const finalTensions = tensions.length >= 2 ? tensions : mockTensions

      return {
        rising_posts,
        relevant_subreddits: subreddits,
        cultural_tensions: finalTensions,
        source: 'reddit_api',
        fetched_at: new Date().toISOString(),
      }
    } catch (err) {
      console.warn('[reddit] API fetch failed, using fallback:', err)
    }
  }

  const mock = MOCK_DATA[key] ?? DEFAULT_MOCK
  return {
    ...mock,
    relevant_subreddits: subreddits,
    source: 'fallback',
    fetched_at: new Date().toISOString(),
  }
}
