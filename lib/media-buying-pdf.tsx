import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

// ─── Types ────────────────────────────────────────────────────

export interface MediaBuyingPlan {
  client_name: string
  client_handle?: string
  objective: string
  market: string
  executive_summary: string
  campaign_objective: {
    primary_goal: string
    kpis: string[]
    secondary_goal: string
  }
  platforms: Array<{
    name: string
    role_description: string
    funnel_stage: string
  }>
  customer_avatars: Array<{
    name: string
    motivation: string
  }>
  option1: {
    budget_sar: number
    allocation: Array<{ platform: string; amount: number }>
    expected_results: Array<{
      platform: string
      metric: string
      min: number
      max: number
    }>
    total_leads_min: number
    total_leads_max: number
    summary: string
  }
  option2: {
    budget_sar: number
    allocation: Array<{ platform: string; amount: number }>
    expected_results: Array<{
      platform: string
      metric: string
      min: number
      max: number
    }>
    total_leads_min: number
    total_leads_max: number
    summary: string
  }
  key_factors: Array<{
    number: string
    title: string
    description: string
  }>
}

export interface PlanImages {
  cover?: string       // data URL — shown right-side on cover
  keyFactors?: string  // data URL — shown left-side on key factors page
  finalOverview?: string // data URL — shown right-side on final overview page
}

// ─── Styles ───────────────────────────────────────────────────

const S = StyleSheet.create({
  // Pages
  page: {
    backgroundColor: '#ffffff',
    padding: '48 56',
    fontFamily: 'Helvetica',
  },
  coverPage: {
    backgroundColor: '#111111',
    fontFamily: 'Helvetica',
    flexDirection: 'row',
    overflow: 'hidden',
  },

  // Cover — two-column
  coverLeft: {
    flex: 1,
    padding: '64 40 64 56',
    justifyContent: 'flex-end',
  },
  coverRight: {
    width: '40%',
    overflow: 'hidden',
  },
  coverRightImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.7,
  },
  coverRightPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  coverLabel: { fontSize: 11, color: '#888888', marginBottom: 4 },
  coverLabelValue: { fontSize: 11, color: '#cccccc', fontFamily: 'Helvetica-Bold' },
  coverRow: { marginTop: 10 },
  coverTitle: {
    fontSize: 42,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    marginBottom: 36,
    lineHeight: 1.15,
  },
  coverDivider: { width: 48, height: 3, backgroundColor: '#555555', marginBottom: 28 },

  // Section heading
  sectionTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 24,
    lineHeight: 1.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 16,
  },

  // Body text
  bodyText: { fontSize: 11, color: '#444444', lineHeight: 1.65, marginBottom: 10 },
  bulletRow: { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },
  bullet: { fontSize: 11, color: '#444444', marginRight: 8, lineHeight: 1.65 },

  // Cards — 3-up row
  cardRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  card3: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: '18 16',
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 8,
  },
  cardBody: { fontSize: 10, color: '#555555', lineHeight: 1.6 },

  // Platform grid — 2×2
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  platformCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: '16 16 16 16',
  },
  platformCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  platformCircleText: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  platformTopBorder: {
    height: 2,
    backgroundColor: '#111111',
    marginBottom: 16,
  },
  platformName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111111', marginBottom: 4 },
  platformDesc: { fontSize: 10, color: '#666666', lineHeight: 1.55 },

  // Budget grid — 2×2 big numbers
  budgetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, marginTop: 24 },
  budgetCell: { width: '50%', paddingBottom: 32, paddingRight: 16 },
  budgetNumber: { fontSize: 52, fontFamily: 'Helvetica-Bold', color: '#222222', lineHeight: 1 },
  budgetPlatform: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#444444', marginTop: 6 },
  budgetCurrency: { fontSize: 10, color: '#888888', marginTop: 2 },

  // Results cards — 2×2
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 24 },
  resultCard: {
    width: '47%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: '14 16',
  },
  resultPlatform: { fontSize: 11, color: '#666666', marginBottom: 6 },
  resultMetricLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111111' },
  resultMetricValue: { fontSize: 10, color: '#444444' },

  // Total leads
  totalLeadsNumber: {
    fontSize: 56,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    lineHeight: 1,
    marginBottom: 4,
  },
  totalLeadsCaption: { fontSize: 9, color: '#888888', marginBottom: 20 },

  // Summary box
  summaryBox: {
    backgroundColor: '#e8e8e8',
    borderRadius: 6,
    padding: '14 16',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  summaryBoxGreen: {
    backgroundColor: '#dcf5dc',
    borderRadius: 6,
    padding: '14 16',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  summaryDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#888888',
    marginTop: 1,
    flexShrink: 0,
  },
  summaryDotGreen: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#3a8a3a',
    marginTop: 1,
    flexShrink: 0,
  },
  summaryTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#222222', marginBottom: 4 },
  summaryBody: { fontSize: 10, color: '#444444', lineHeight: 1.55, flex: 1 },

  // Key factors — with optional image
  keyFactorsLayout: { flexDirection: 'row', gap: 28 },
  keyFactorsImage: {
    width: '38%',
    borderRadius: 8,
    objectFit: 'cover',
    flexShrink: 0,
  },
  keyFactorsContent: { flex: 1 },
  factorRow: { marginBottom: 18, borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 14 },
  factorNumber: { fontSize: 10, color: '#888888', marginBottom: 5 },
  factorTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111111', marginBottom: 4 },
  factorDesc: { fontSize: 10, color: '#555555', lineHeight: 1.6 },

  // Final overview — with optional image
  finalLayout: { flexDirection: 'row', gap: 20 },
  overviewCards: { flex: 1 },
  finalImage: {
    width: '40%',
    borderRadius: 8,
    objectFit: 'cover',
    flexShrink: 0,
  },
  overviewCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    padding: '18 16',
    marginBottom: 12,
  },
  overviewCardTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 10 },
  overviewExpected: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#cccccc', marginBottom: 3 },
  overviewValue: { fontSize: 10, color: '#aaaaaa', marginBottom: 8 },
  overviewPhase: { fontSize: 9, color: '#777777' },

  // Page footer
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: { fontSize: 8, color: '#bbbbbb' },
})

// ─── Sub-components ───────────────────────────────────────────

function PageFooter({ clientName }: { clientName: string }) {
  return (
    <View style={S.footer}>
      <Text style={S.footerText}>{clientName} — Media Buying Plan</Text>
      <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

// ─── Pages ────────────────────────────────────────────────────

function CoverPage({ plan, images }: { plan: MediaBuyingPlan; images?: PlanImages }) {
  return (
    <Page size="A4" style={S.coverPage}>
      {/* Left — title + meta */}
      <View style={S.coverLeft}>
        <Text style={S.coverTitle}>Media Buying{'\n'}Plan</Text>
        <View style={S.coverDivider} />
        <View style={S.coverRow}>
          <Text style={S.coverLabel}>
            Client:{' '}
            <Text style={S.coverLabelValue}>
              {plan.client_handle ? `${plan.client_handle} (${plan.client_name})` : plan.client_name}
            </Text>
          </Text>
        </View>
        <View style={[S.coverRow, { marginTop: 6 }]}>
          <Text style={S.coverLabel}>Objective: <Text style={S.coverLabelValue}>{plan.objective}</Text></Text>
        </View>
        <View style={[S.coverRow, { marginTop: 6 }]}>
          <Text style={S.coverLabel}>Market: <Text style={S.coverLabelValue}>{plan.market}</Text></Text>
        </View>
      </View>

      {/* Right — contextual image or dark placeholder */}
      <View style={S.coverRight}>
        {images?.cover
          ? <Image src={images.cover} style={S.coverRightImage} />
          : <View style={S.coverRightPlaceholder} />}
      </View>
    </Page>
  )
}

function ExecutiveSummaryPage({ plan }: { plan: MediaBuyingPlan }) {
  return (
    <Page size="A4" style={S.page}>
      <Text style={S.sectionTitle}>Executive Summary</Text>
      {plan.executive_summary.split('\n').filter(Boolean).map((para, i) => (
        <Text key={i} style={S.bodyText}>{para.trim()}</Text>
      ))}
      <PageFooter clientName={plan.client_name} />
    </Page>
  )
}

function CampaignObjectivePage({ plan }: { plan: MediaBuyingPlan }) {
  return (
    <Page size="A4" style={S.page}>
      <Text style={S.sectionTitle}>Campaign Objective</Text>
      <View style={S.cardRow}>
        <View style={S.card3}>
          <Text style={S.cardTitle}>Primary Goal</Text>
          <Text style={S.cardBody}>{plan.campaign_objective.primary_goal}</Text>
        </View>
        <View style={S.card3}>
          <Text style={S.cardTitle}>Key Performance{'\n'}Indicators</Text>
          {plan.campaign_objective.kpis.map((kpi, i) => (
            <View key={i} style={[S.bulletRow, { marginBottom: 3 }]}>
              <Text style={[S.bullet, { fontSize: 9 }]}>•</Text>
              <Text style={[S.cardBody, { flex: 1 }]}>{kpi}</Text>
            </View>
          ))}
        </View>
        <View style={S.card3}>
          <Text style={S.cardTitle}>Secondary Goal</Text>
          <Text style={S.cardBody}>{plan.campaign_objective.secondary_goal}</Text>
        </View>
      </View>

      {plan.customer_avatars.length > 0 && (
        <>
          <Text style={[S.sectionSubtitle, { marginTop: 32 }]}>Target Customer Segments</Text>
          <View style={S.cardRow}>
            {plan.customer_avatars.slice(0, 3).map((a, i) => (
              <View key={i} style={S.card3}>
                <Text style={S.cardTitle}>{a.name}</Text>
                <Text style={S.cardBody}>{a.motivation}</Text>
              </View>
            ))}
          </View>
          {plan.customer_avatars.length > 3 && (
            <View style={[S.cardRow, { marginTop: 12 }]}>
              {plan.customer_avatars.slice(3).map((a, i) => (
                <View key={i} style={S.card3}>
                  <Text style={S.cardTitle}>{a.name}</Text>
                  <Text style={S.cardBody}>{a.motivation}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
      <PageFooter clientName={plan.client_name} />
    </Page>
  )
}

function PlatformsPage({ plan }: { plan: MediaBuyingPlan }) {
  return (
    <Page size="A4" style={S.page}>
      <Text style={S.sectionTitle}>Advertising Platforms</Text>
      <View style={S.platformGrid}>
        {plan.platforms.map((p, i) => (
          <View key={i} style={S.platformCard}>
            <View style={S.platformTopBorder} />
            <View style={S.platformCircle}>
              <Text style={S.platformCircleText}>{i + 1}</Text>
            </View>
            <Text style={S.platformName}>{p.name}</Text>
            <Text style={S.platformDesc}>{p.role_description}</Text>
          </View>
        ))}
      </View>
      <Text style={[S.bodyText, { marginTop: 20, fontSize: 10, color: '#666666' }]}>
        Each platform serves a different stage in the customer journey from awareness to conversion.
      </Text>
      <PageFooter clientName={plan.client_name} />
    </Page>
  )
}

function BudgetPage({ option, num }: { option: MediaBuyingPlan['option1']; num: 1 | 2 }) {
  return (
    <Page size="A4" style={S.page}>
      <Text style={S.sectionTitle}>
        Option {num} – Budget: {option.budget_sar.toLocaleString()} SAR per month
      </Text>
      <Text style={[S.sectionSubtitle, { marginTop: 0 }]}>Budget Allocation</Text>
      <View style={S.budgetGrid}>
        {option.allocation.map((a, i) => (
          <View key={i} style={S.budgetCell}>
            <Text style={S.budgetNumber}>{a.amount.toLocaleString()}</Text>
            <Text style={S.budgetPlatform}>{a.platform}</Text>
            <Text style={S.budgetCurrency}>SAR</Text>
          </View>
        ))}
      </View>
    </Page>
  )
}

function ResultsPage({
  option,
  num,
  clientName,
}: {
  option: MediaBuyingPlan['option1']
  num: 1 | 2
  clientName: string
}) {
  const isOption2 = num === 2
  return (
    <Page size="A4" style={S.page}>
      <Text style={S.sectionTitle}>Expected Monthly Results</Text>
      <View style={S.resultGrid}>
        {option.expected_results.map((r, i) => (
          <View key={i} style={S.resultCard}>
            <Text style={S.resultPlatform}>{r.platform}</Text>
            <Text style={S.resultMetricLabel}>
              Expected {r.metric}:{' '}
              <Text style={S.resultMetricValue}>{r.min} – {r.max}</Text>
            </Text>
          </View>
        ))}
      </View>

      <Text style={[S.sectionSubtitle, { marginBottom: 8 }]}>
        Total Expected Results (Option {num})
      </Text>
      <Text style={S.totalLeadsNumber}>
        {option.total_leads_min} – {option.total_leads_max}
      </Text>
      <Text style={S.totalLeadsCaption}>
        Total Monthly Leads: Messages + Calls combined
      </Text>

      <View style={isOption2 ? S.summaryBoxGreen : S.summaryBox}>
        <View style={isOption2 ? S.summaryDotGreen : S.summaryDot} />
        <View style={{ flex: 1 }}>
          <Text style={S.summaryTitle}>Summary of Option {num}</Text>
          <Text style={S.summaryBody}>{option.summary}</Text>
        </View>
      </View>
      <PageFooter clientName={clientName} />
    </Page>
  )
}

function KeyFactorsPage({ plan, images }: { plan: MediaBuyingPlan; images?: PlanImages }) {
  return (
    <Page size="A4" style={S.page}>
      <Text style={S.sectionTitle}>Key Factors Affecting{'\n'}Performance</Text>
      <View style={images?.keyFactors ? S.keyFactorsLayout : undefined}>
        {images?.keyFactors && (
          <Image src={images.keyFactors} style={S.keyFactorsImage} />
        )}
        <View style={images?.keyFactors ? S.keyFactorsContent : undefined}>
          {plan.key_factors.map((f, i) => (
            <View
              key={i}
              style={[S.factorRow, i === 0 ? { borderTopWidth: 0, paddingTop: 0 } : {}]}
            >
              <Text style={S.factorNumber}>{f.number}</Text>
              <Text style={S.factorTitle}>{f.title}</Text>
              <Text style={S.factorDesc}>{f.description}</Text>
            </View>
          ))}
        </View>
      </View>
      <PageFooter clientName={plan.client_name} />
    </Page>
  )
}

function FinalOverviewPage({ plan, images }: { plan: MediaBuyingPlan; images?: PlanImages }) {
  return (
    <Page size="A4" style={S.page}>
      <Text style={S.sectionTitle}>Final Overview</Text>
      <View style={images?.finalOverview ? S.finalLayout : undefined}>
        <View style={images?.finalOverview ? S.overviewCards : undefined}>
          <View style={S.overviewCard}>
            <Text style={S.overviewCardTitle}>
              Option 1 ({plan.option1.budget_sar.toLocaleString()} SAR)
            </Text>
            <Text style={S.overviewExpected}>Expected:</Text>
            <Text style={S.overviewValue}>
              {plan.option1.total_leads_min} – {plan.option1.total_leads_max} total leads
            </Text>
            <Text style={S.overviewPhase}>{plan.option1.summary.split('.')[0]}.</Text>
          </View>
          <View style={S.overviewCard}>
            <Text style={S.overviewCardTitle}>
              Option 2 ({plan.option2.budget_sar.toLocaleString()} SAR)
            </Text>
            <Text style={S.overviewExpected}>Expected:</Text>
            <Text style={S.overviewValue}>
              {plan.option2.total_leads_min} – {plan.option2.total_leads_max} total leads
            </Text>
            <Text style={S.overviewPhase}>{plan.option2.summary.split('.')[0]}.</Text>
          </View>
        </View>
        {images?.finalOverview && (
          <Image src={images.finalOverview} style={S.finalImage} />
        )}
      </View>
      <PageFooter clientName={plan.client_name} />
    </Page>
  )
}

// ─── Document ─────────────────────────────────────────────────

export function MediaBuyingPlanDocument({
  plan,
  images,
}: {
  plan: MediaBuyingPlan
  images?: PlanImages
}) {
  return (
    <Document
      title={`${plan.client_name} — Media Buying Plan`}
      author="NOVAX"
      creator="NOVAX Ops"
    >
      <CoverPage plan={plan} images={images} />
      <ExecutiveSummaryPage plan={plan} />
      <CampaignObjectivePage plan={plan} />
      <PlatformsPage plan={plan} />
      <BudgetPage option={plan.option1} num={1} />
      <ResultsPage option={plan.option1} num={1} clientName={plan.client_name} />
      <BudgetPage option={plan.option2} num={2} />
      <ResultsPage option={plan.option2} num={2} clientName={plan.client_name} />
      <KeyFactorsPage plan={plan} images={images} />
      <FinalOverviewPage plan={plan} images={images} />
    </Document>
  )
}
