const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', '(app)', 'reports', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');
let changed = false;

// ── Fix 1: Remove duplicate component block (lines 463-587) ──────────────────
// The duplicate starts immediately after RecommendationsList's closing brace
// and ends just before the "// ─── Deep report shared components" comment.
// We identify it by matching from the first duplicate CoverPage to the comment.

const dupStart = `\nfunction CoverPage({ title, subtitle, client, period, tag }: { title: string; subtitle: string; client: string; period: string; tag: string }) {
  return (
    <div className="report-cover-page rounded-2xl overflow-hidden flex flex-col" style={{ background: B.primary }}>
      <div className="h-2" style={{ background: \`linear-gradient(90deg, \${B.accent}, \${B.border}, \${B.light})\`}}/>
      <div className="px-12 pt-12 flex items-center gap-4">
        <svg width="52" height="52" viewBox="0 0 32 32" fill="none">`;

// More robust: find and remove everything between RecommendationsList end and the deep-components comment
const recListEnd = `    </div>
  )
}

function CoverPage`;
const deepComponentsComment = `// ─── Deep report shared components`;

const startIdx = content.indexOf(recListEnd);
const endIdx   = content.indexOf(deepComponentsComment);

if (startIdx !== -1 && endIdx !== -1) {
  // Keep everything up to and including the closing brace of RecommendationsList,
  // then skip to the deep-components comment
  const keepBefore = content.substring(0, startIdx + `    </div>
  )
}`.length);
  const keepAfter  = content.substring(endIdx);
  content = keepBefore + '\n\n' + keepAfter;
  console.log('Fix 1 applied: duplicate component block removed');
  changed = true;
} else {
  console.log('Fix 1 SKIP: markers not found (may already be fixed)');
  console.log('  recListEnd idx:', startIdx, '  deepComponents idx:', endIdx);
}

// ── Fix 2: Add narrative.platform to MONTHLY_DEMO ────────────────────────────
const narrativePlatformMarker = `    engagement: 'The 5.8% blended engagement rate masks significant format-level variation. Reels achieved 8.4% ER — more than double the industry benchmark for the format — with saves increasing 29.6% month-on-month as a reliable proxy for content utility. Static posts declined to 4.1% average ER as the algorithm increasingly deprioritises non-video formats. Stories averaged 3.8% interaction rate, below the account\\'s own historical benchmark of 4.6%, and require corrective action in June through improved posting cadence and hook quality.',
  },`;

const narrativePlatformReplacement = `    engagement: 'The 5.8% blended engagement rate masks significant format-level variation. Reels achieved 8.4% ER — more than double the industry benchmark for the format — with saves increasing 29.6% month-on-month as a reliable proxy for content utility. Static posts declined to 4.1% average ER as the algorithm increasingly deprioritises non-video formats. Stories averaged 3.8% interaction rate, below the account\\'s own historical benchmark of 4.6%, and require corrective action in June through improved posting cadence and hook quality.',
    platform: 'Instagram remains the primary growth engine, accounting for 59% of total reach from 53% of posts — a favourable over-index that reflects algorithm alignment with current creative output. TikTok\\'s 9.1% engagement rate on a comparatively small audience of 12,400 followers represents the highest-upside organic channel in the portfolio. Facebook continues to underperform relative to investment: at 3.4% ER and $6,800 CPC on boosted posts, the platform\\'s return profile warrants reallocation of budget and creative attention toward Instagram and TikTok in Q2.',
  },`;

if (content.includes(narrativePlatformMarker)) {
  content = content.replace(narrativePlatformMarker, narrativePlatformReplacement);
  console.log('Fix 2 applied: narrative.platform added to MONTHLY_DEMO');
  changed = true;
} else {
  console.log('Fix 2 SKIP: marker not found (may already be fixed)');
}

// ── Fix 3: Add q2Priorities to QUARTERLY_DEMO ────────────────────────────────
const q2PrioritiesMarker = `    priorities: 'Three priorities define Q2 strategy. First, the TikTok opportunity: Q1\\'s 9.1% ER at low posting frequency signals a highly receptive audience that is not yet being maximised. Doubling posting frequency to 14 videos per month is the single highest-upside action. Second, the paid retargeting stack produced 5.2× ROAS in Q1 — budget scaling to $5,000 per month is the highest-confidence paid investment. Third, the existing creative-to-paid promotion pipeline (boosting organic top performers) should be systematised to cover all posts with ER above 8%.',
  },
}`;

const q2PrioritiesReplacement = `    priorities: 'Three priorities define Q2 strategy. First, the TikTok opportunity: Q1\\'s 9.1% ER at low posting frequency signals a highly receptive audience that is not yet being maximised. Doubling posting frequency to 14 videos per month is the single highest-upside action. Second, the paid retargeting stack produced 5.2× ROAS in Q1 — budget scaling to $5,000 per month is the highest-confidence paid investment. Third, the existing creative-to-paid promotion pipeline (boosting organic top performers) should be systematised to cover all posts with ER above 8%.',
  },
  q2Priorities: [
    { priority: 'Scale TikTok organic to 14 videos per month', rationale: 'Q1 TikTok ER of 9.1% on a modest following signals a highly engaged audience that is currently under-served. Doubling posting frequency is the single highest-upside organic action available and requires no incremental budget.' },
    { priority: 'Increase paid retargeting budget to $5,000/month', rationale: 'The retargeting campaign delivered 5.2× ROAS in Q1 — the highest-performing paid activation. Scaling spend to $5,000/month at current conversion rates projects $26,000 incremental revenue per month, representing the best risk-adjusted paid investment.' },
    { priority: 'Systematise organic-to-paid promotion pipeline', rationale: 'All organic posts achieving above 8% ER should be evaluated for paid promotion within 48 hours of publishing. This pipeline produced 3.8× ROAS on boosted posts in Q1 and should be formalised as a standing workflow across all campaigns.' },
  ],
}`;

if (content.includes(q2PrioritiesMarker)) {
  content = content.replace(q2PrioritiesMarker, q2PrioritiesReplacement);
  console.log('Fix 3 applied: q2Priorities added to QUARTERLY_DEMO');
  changed = true;
} else {
  console.log('Fix 3 SKIP: marker not found (may already be fixed)');
}

if (changed) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('\nFile saved successfully.');
} else {
  console.log('\nNo changes made.');
}
