import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — NOVAX',
  description: 'Privacy Policy for NOVAX and its digital services.',
}

const EFFECTIVE_DATE = 'June 12, 2026'
const CONTACT_EMAIL  = 'novaaxone@gmail.com'
const SITE_URL       = 'https://www.novaxops.com'

// ── Section heading ──────────────────────────────────────────

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-lg font-bold text-slate-900 mt-10 mb-3 pb-2 border-b border-slate-200"
    >
      {children}
    </h2>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-slate-800 mt-5 mb-2">{children}</h3>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm text-slate-600 leading-relaxed flex gap-2">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
      <span>{children}</span>
    </li>
  )
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-1.5 mb-4 pl-1">{children}</ul>
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-4 bg-[#EBF4F3] border border-[#9DCCC8] rounded-xl">
      <p className="text-sm text-[#1B3D38] leading-relaxed">{children}</p>
    </div>
  )
}

// ── Table of contents ────────────────────────────────────────

const TOC = [
  { id: 'who-we-are',           label: '1. Who We Are' },
  { id: 'data-we-collect',      label: '2. Data We Collect' },
  { id: 'how-we-use-data',      label: '3. How We Use Your Data' },
  { id: 'third-party-services', label: '4. Third-Party Services & APIs' },
  { id: 'pinterest-api',        label: '5. Pinterest API Data — Special Terms' },
  { id: 'data-storage',         label: '6. Data Storage & Security' },
  { id: 'data-retention',       label: '7. Data Retention' },
  { id: 'user-rights',          label: '8. Your Rights' },
  { id: 'cookies',              label: '9. Cookies & Tracking' },
  { id: 'children',             label: '10. Children\'s Privacy' },
  { id: 'changes',              label: '11. Changes to This Policy' },
  { id: 'contact',              label: '12. Contact Us' },
]

// ── Page ─────────────────────────────────────────────────────

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Header bar */}
      <header className="border-b border-slate-200 bg-[#1B3D38]">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* NOVAX wordmark */}
            <span className="text-white font-black text-xl tracking-widest">NOVAX</span>
          </div>
          <a
            href={SITE_URL}
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            {SITE_URL.replace('https://', '')}
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">

        {/* Title block */}
        <div className="mb-10">
          <div className="inline-block px-3 py-1 rounded-full bg-[#EBF4F3] text-[#1B3D38] text-xs font-semibold mb-4 border border-[#9DCCC8]">
            Legal
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-slate-500">
            Effective date: <strong>{EFFECTIVE_DATE}</strong>
            {' '}· Last updated: <strong>{EFFECTIVE_DATE}</strong>
          </p>
        </div>

        {/* Intro */}
        <P>
          NOVAX (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the platform available at{' '}
          <a href={SITE_URL} className="text-[#1B3D38] underline underline-offset-2 font-medium">{SITE_URL}</a>{' '}
          (the &ldquo;Service&rdquo;). This Privacy Policy explains how we collect, use, disclose, and safeguard
          information about you when you use our Service, and describes your rights with respect to that information.
        </P>
        <P>
          By accessing or using our Service, you agree to the collection and use of information as described in this
          Policy. If you do not agree, please do not use the Service.
        </P>

        {/* Table of contents */}
        <div className="my-8 p-5 bg-slate-50 border border-slate-200 rounded-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Contents</p>
          <nav className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {TOC.map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-sm text-[#1B3D38] hover:text-[#2A6B62] transition-colors py-0.5"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* ── 1. Who We Are ── */}
        <H2 id="who-we-are">1. Who We Are</H2>
        <P>
          NOVAX is a social media and creative marketing agency. Our internal operations platform, accessible at{' '}
          {SITE_URL}, is used by our team to manage client content pipelines, scheduling, publishing, moderation,
          and creative production. The platform integrates with third-party services including Pinterest, Google Drive,
          and social media scheduling tools.
        </P>
        <P>
          <strong>Data Controller:</strong> NOVAX<br />
          <strong>Contact:</strong>{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#1B3D38] underline underline-offset-2 font-medium">
            {CONTACT_EMAIL}
          </a>
        </P>

        {/* ── 2. Data We Collect ── */}
        <H2 id="data-we-collect">2. Data We Collect</H2>

        <H3>2.1 Account & Profile Data</H3>
        <Ul>
          <Li>Name, email address, phone number, and password (hashed) when you create an account</Li>
          <Li>Your role and permissions within the platform</Li>
          <Li>Profile preferences such as language and notification settings</Li>
        </Ul>

        <H3>2.2 Content & Usage Data</H3>
        <Ul>
          <Li>Tasks, notes, briefs, and creative documents you create or edit in the platform</Li>
          <Li>Uploaded assets (images, videos, documents) stored in our secure asset library</Li>
          <Li>AI-generated outputs you save or approve</Li>
          <Li>Activity logs (actions taken, pages visited, timestamps) for audit and security purposes</Li>
        </Ul>

        <H3>2.3 Third-Party Integration Data</H3>
        <Ul>
          <Li>
            OAuth tokens and credentials for connected services (e.g. Google Drive) — stored encrypted and used
            exclusively to perform actions you authorize
          </Li>
          <Li>
            Data retrieved from third-party APIs (e.g. Pinterest, social media analytics) — used only within
            your current session to provide the requested feature; see Section 5 for Pinterest-specific terms
          </Li>
        </Ul>

        <H3>2.4 Technical Data</H3>
        <Ul>
          <Li>IP address, browser type, device type, and operating system</Li>
          <Li>Session tokens managed by Supabase authentication</Li>
          <Li>Error logs and performance metrics (no personally identifiable information)</Li>
        </Ul>

        {/* ── 3. How We Use Data ── */}
        <H2 id="how-we-use-data">3. How We Use Your Data</H2>
        <P>We use collected data <strong>only</strong> to:</P>
        <Ul>
          <Li>Authenticate and authorize access to the platform</Li>
          <Li>Provide, operate, and improve the Service features you use</Li>
          <Li>Fulfill actions you explicitly request (e.g. scheduling a post, generating AI copy, importing a file)</Li>
          <Li>Send transactional emails (account invitations, reminders, approval notifications)</Li>
          <Li>Maintain security, detect fraud, and generate internal audit logs</Li>
          <Li>Comply with applicable legal obligations</Li>
        </Ul>
        <Highlight>
          We do <strong>not</strong> sell your data. We do <strong>not</strong> use your data for advertising
          targeting, profiling, or any purpose beyond operating and improving the Service for you.
        </Highlight>

        {/* ── 4. Third-Party Services ── */}
        <H2 id="third-party-services">4. Third-Party Services &amp; APIs</H2>
        <P>
          Our Service integrates with external platforms to provide functionality. Each integration is subject to
          that platform&rsquo;s own terms and privacy policy.
        </P>

        <div className="overflow-x-auto my-4">
          <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">Service</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">Purpose</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">Data Shared</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['Pinterest API', 'Content inspiration and trend discovery', 'Search queries; no user personal data'],
                ['Google Drive', 'Asset import and storage', 'OAuth access token (per user, revocable)'],
                ['Supabase', 'Database, authentication, file storage', 'All platform data (encrypted at rest)'],
                ['Anthropic (Claude)', 'AI-generated copy and analysis', 'Content briefs and task context (no PII)'],
                ['Google (Gemini)', 'AI fallback model', 'Content briefs and task context (no PII)'],
                ['Resend', 'Transactional email', 'Email address, name'],
                ['Apify', 'Web content scraping for trend discovery', 'Search queries only'],
                ['Vercel', 'Hosting and deployment', 'Request metadata, logs'],
              ].map(([svc, purpose, data]) => (
                <tr key={svc}>
                  <td className="px-4 py-3 font-medium text-slate-800">{svc}</td>
                  <td className="px-4 py-3 text-slate-600">{purpose}</td>
                  <td className="px-4 py-3 text-slate-500">{data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <P>
          We do not share personally identifiable information with third-party advertisers or data brokers. We do
          not permit third parties to use your data for their own marketing purposes.
        </P>

        {/* ── 5. Pinterest API ── */}
        <H2 id="pinterest-api">5. Pinterest API Data — Special Terms</H2>
        <Highlight>
          This section governs our use of data accessed through the Pinterest API and is required by
          Pinterest&rsquo;s Developer &amp; API Terms of Service.
        </Highlight>

        <H3>5.1 Scope of Pinterest Data Use</H3>
        <P>
          We access the Pinterest API solely to provide content inspiration and trend-discovery features
          to authenticated users of our platform. All Pinterest data retrieved is used exclusively to
          serve the specific request of the authenticated user making the request.
        </P>

        <H3>5.2 No Data Storage</H3>
        <P>
          Consistent with Pinterest&rsquo;s Developer Guidelines, <strong>we do not persistently store
          any data retrieved from the Pinterest API</strong>. Pinterest content (pins, board data, search
          results) is fetched in real time and displayed only within the active session. No Pinterest content
          is written to our databases, caches, or storage systems beyond the duration of the API call required
          to serve the immediate user request.
        </P>

        <H3>5.3 No Cross-User Aggregation</H3>
        <P>
          We do not combine Pinterest data across multiple users, aggregate it into audience segments, or
          use it to build profiles. Each API call is isolated to the individual user session that triggered it.
        </P>

        <H3>5.4 No Third-Party Sharing</H3>
        <P>
          We do not share, sell, license, or otherwise disclose Pinterest API data to any third party.
          Pinterest data is never used for advertising targeting, retargeting, or any off-platform commercial purpose.
        </P>

        <H3>5.5 No Advertising Use</H3>
        <P>
          Pinterest data retrieved through the API is never used to target users with advertising, either on
          Pinterest or on any other platform. We do not use Pinterest data to build advertising audiences or
          lookalike models.
        </P>

        <H3>5.6 Compliance with Pinterest Terms</H3>
        <P>
          Our use of the Pinterest API complies with Pinterest&rsquo;s{' '}
          <a
            href="https://policy.pinterest.com/en/developer-guidelines"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1B3D38] underline underline-offset-2 font-medium"
          >
            Developer Guidelines
          </a>{' '}
          and{' '}
          <a
            href="https://developers.pinterest.com/terms/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1B3D38] underline underline-offset-2 font-medium"
          >
            API Terms of Service
          </a>.
          Users wishing to revoke our access to any Pinterest-connected account may do so through their
          Pinterest account settings at{' '}
          <a
            href="https://www.pinterest.com/settings/security"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1B3D38] underline underline-offset-2 font-medium"
          >
            pinterest.com/settings/security
          </a>.
        </P>

        {/* ── 6. Data Storage & Security ── */}
        <H2 id="data-storage">6. Data Storage &amp; Security</H2>
        <P>
          All platform data is stored in Supabase (PostgreSQL), hosted on infrastructure that complies
          with SOC 2 Type II. Data is encrypted at rest and in transit using TLS 1.2+.
        </P>
        <Ul>
          <Li>Passwords are never stored in plaintext — authentication is managed by Supabase Auth (GoTrue)</Li>
          <Li>OAuth tokens for third-party services are stored encrypted and scoped to the individual user</Li>
          <Li>File assets are stored in Supabase Storage with access controlled by row-level security policies</Li>
          <Li>All API keys and secrets are stored as server-side environment variables, never exposed to the client</Li>
        </Ul>
        <P>
          Despite these measures, no method of transmission over the Internet or electronic storage is 100%
          secure. We cannot guarantee absolute security but commit to promptly notifying affected users of any
          confirmed data breach.
        </P>

        {/* ── 7. Data Retention ── */}
        <H2 id="data-retention">7. Data Retention</H2>
        <Ul>
          <Li>
            <strong>Account data:</strong> retained for the duration of your account and deleted within
            30 days of account termination upon request
          </Li>
          <Li>
            <strong>Content & assets:</strong> retained until you delete them or your account is closed
          </Li>
          <Li>
            <strong>Audit logs:</strong> retained for 12 months for security and compliance purposes,
            then automatically deleted
          </Li>
          <Li>
            <strong>Third-party API data (including Pinterest):</strong> not stored — see Section 5.2
          </Li>
          <Li>
            <strong>AI generation cache:</strong> retained for up to 90 days to avoid duplicate API costs,
            keyed by a hash of the request — no personally identifiable information is stored in the cache
          </Li>
        </Ul>

        {/* ── 8. User Rights ── */}
        <H2 id="user-rights">8. Your Rights</H2>
        <P>
          Depending on your jurisdiction, you may have the following rights regarding your personal data:
        </P>
        <Ul>
          <Li><strong>Access:</strong> request a copy of the personal data we hold about you</Li>
          <Li><strong>Rectification:</strong> request correction of inaccurate or incomplete data</Li>
          <Li><strong>Erasure:</strong> request deletion of your personal data (&ldquo;right to be forgotten&rdquo;)</Li>
          <Li><strong>Restriction:</strong> request that we limit how we process your data</Li>
          <Li><strong>Portability:</strong> receive your data in a structured, machine-readable format</Li>
          <Li><strong>Objection:</strong> object to processing based on legitimate interests</Li>
          <Li>
            <strong>Withdrawal of consent:</strong> where processing is based on consent, you may withdraw
            it at any time without affecting the lawfulness of prior processing
          </Li>
        </Ul>
        <P>
          To exercise any of these rights, contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#1B3D38] underline underline-offset-2 font-medium">
            {CONTACT_EMAIL}
          </a>. We will respond within 30 days.
        </P>
        <P>
          To revoke third-party service access (e.g. Google Drive, Pinterest), you may do so directly through
          those services&rsquo; account security settings, or by contacting us and we will remove the stored
          credentials immediately.
        </P>

        {/* ── 9. Cookies ── */}
        <H2 id="cookies">9. Cookies &amp; Tracking</H2>
        <P>
          We use strictly necessary cookies to operate the Service:
        </P>
        <Ul>
          <Li>
            <strong>Session cookies:</strong> managed by Supabase Auth to maintain your authenticated session.
            These are deleted when you log out or close your browser.
          </Li>
          <Li>
            <strong>Theme preference:</strong> a single localStorage key to remember your light/dark mode choice.
            No personal data is stored.
          </Li>
        </Ul>
        <P>
          We do <strong>not</strong> use advertising cookies, tracking pixels, third-party analytics scripts
          (e.g. Google Analytics, Facebook Pixel), or any cross-site tracking technology.
        </P>

        {/* ── 10. Children ── */}
        <H2 id="children">10. Children&rsquo;s Privacy</H2>
        <P>
          Our Service is intended solely for use by adults (18+) in a professional agency context. We do not
          knowingly collect personal data from anyone under the age of 13. If we become aware that we have
          inadvertently collected such data, we will delete it immediately. If you believe a minor&rsquo;s data
          has been collected, please contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#1B3D38] underline underline-offset-2 font-medium">
            {CONTACT_EMAIL}
          </a>.
        </P>

        {/* ── 11. Changes ── */}
        <H2 id="changes">11. Changes to This Policy</H2>
        <P>
          We may update this Privacy Policy from time to time to reflect changes in our practices, technology,
          or legal requirements. When we make material changes, we will update the &ldquo;Last updated&rdquo;
          date at the top of this page and, where appropriate, notify platform users via in-app notification
          or email.
        </P>
        <P>
          Your continued use of the Service after any changes constitutes your acceptance of the updated Policy.
          We encourage you to review this page periodically.
        </P>

        {/* ── 12. Contact ── */}
        <H2 id="contact">12. Contact Us</H2>
        <P>
          For any privacy-related questions, requests, or complaints, please contact:
        </P>
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 my-4">
          <p className="text-sm font-bold text-slate-800">NOVAX</p>
          <p className="text-sm text-slate-600">
            Email:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#1B3D38] underline underline-offset-2 font-medium">
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="text-sm text-slate-600">
            Website:{' '}
            <a href={SITE_URL} className="text-[#1B3D38] underline underline-offset-2 font-medium">
              {SITE_URL}
            </a>
          </p>
        </div>
        <P>
          We take privacy concerns seriously and will respond to all inquiries within 30 days.
        </P>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} NOVAX. All rights reserved.
          </p>
          <p className="text-xs text-slate-400">
            Effective: {EFFECTIVE_DATE}
          </p>
        </div>
      </footer>

    </div>
  )
}
