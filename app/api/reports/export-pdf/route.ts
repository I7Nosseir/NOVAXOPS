import { NextRequest, NextResponse } from 'next/server'

interface KPIItem {
  metric: string
  value: string
}

interface TableRow {
  [key: string]: string | number | boolean
}

interface ReportTable {
  title?: string
  headers: string[]
  rows: TableRow[]
}

interface ReportData {
  kpis?: KPIItem[]
  tables?: ReportTable[]
  [key: string]: unknown
}

function generateReportHTML(
  tab: string,
  clientName: string,
  period: string,
  data: ReportData,
): string {
  const tabLabel: Record<string, string> = {
    monthly:   'Monthly Performance Report',
    paid:      'Paid Media Performance Report',
    combined:  'Paid + Organic Combined Report',
    platform:  'Platform Deep Dive',
    quarterly: 'Quarterly Report',
    executive: 'Executive Summary',
    ai:        'AI-Generated Report',
  }
  const title = tabLabel[tab] ?? tab

  const kpiRows = (data.kpis ?? [])
    .map((k: KPIItem) => `
      <div class="kpi-card">
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-label">${k.metric}</div>
      </div>`)
    .join('')

  const tablesSections = (data.tables ?? [])
    .map((t: ReportTable) => {
      const headerCells = t.headers.map(h => `<th>${h}</th>`).join('')
      const bodyRows = t.rows
        .map(r => {
          const cells = t.headers.map(h => `<td>${r[h] ?? ''}</td>`).join('')
          return `<tr>${cells}</tr>`
        })
        .join('')
      return `
        ${t.title ? `<h3 class="section-title">${t.title}</h3>` : ''}
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} — ${clientName}</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #1e293b;
      background: #fff;
      padding: 0;
    }

    /* ── Print setup ── */
    @media print {
      @page { size: A4; margin: 18mm 15mm; }
      .no-print { display: none !important; }
      body { padding: 0; }
      .page-break { page-break-before: always; }
    }

    /* ── Header ── */
    .report-header {
      background: #1B3D38;
      color: #fff;
      padding: 28px 32px 20px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
    }
    .report-header-left { display: flex; align-items: center; gap: 16px; }
    .logo-mark {
      width: 40px; height: 40px;
      background: rgba(255,255,255,0.12);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .brand-name { font-size: 16px; font-weight: 800; letter-spacing: -0.3px; }
    .brand-sub  { font-size: 9px; font-weight: 600; color: #5BB4AE; margin-top: 2px; letter-spacing: 1px; }
    .divider { width: 1px; height: 40px; background: rgba(255,255,255,0.2); margin: 0 4px; }
    .report-title { font-size: 18px; font-weight: 700; line-height: 1.2; }
    .report-subtitle { font-size: 11px; color: #9DCCC8; margin-top: 4px; }
    .report-header-right { text-align: right; flex-shrink: 0; }
    .client-name { font-size: 14px; font-weight: 700; }
    .period-label { font-size: 11px; color: #9DCCC8; margin-top: 4px; }
    .confidential { font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 8px; }
    .accent-bar {
      height: 3px;
      background: linear-gradient(90deg, #5BB4AE, #9DCCC8, #EBF4F3);
    }

    /* ── Content ── */
    .content { padding: 28px 32px; }

    /* ── Print button ── */
    .print-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 20px 32px;
      padding: 10px 20px;
      background: #1B3D38;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
    }
    .print-btn:hover { background: #163330; }

    /* ── KPI grid ── */
    .kpi-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 28px;
    }
    .kpi-card {
      flex: 1 1 160px;
      background: #EBF4F3;
      border: 1px solid #9DCCC8;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .kpi-value {
      font-size: 24px;
      font-weight: 800;
      color: #1B3D38;
      line-height: 1.1;
    }
    .kpi-label {
      font-size: 11px;
      color: #2A6B62;
      font-weight: 600;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ── Section title ── */
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #1B3D38;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      border-bottom: 2px solid #9DCCC8;
      padding-bottom: 6px;
      margin: 24px 0 12px;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 20px;
    }
    th {
      background: #EBF4F3;
      color: #1B3D38;
      font-weight: 700;
      font-size: 11px;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid #9DCCC8;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    tr:nth-child(even) td { background: #f8fafc; }

    /* ── Footer ── */
    .footer {
      margin-top: 36px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
    .footer-logo {
      font-weight: 700;
      color: #1B3D38;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="report-header">
    <div class="report-header-left">
      <div class="logo-mark">
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
          <path d="M8 24V8l6 16 6-16v16" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="24" cy="16" r="3" fill="#5BB4AE"/>
        </svg>
      </div>
      <div>
        <div class="brand-name">NOVAX</div>
        <div class="brand-sub">OPS PLATFORM</div>
      </div>
      <div class="divider"></div>
      <div>
        <div class="report-title">${title}</div>
        <div class="report-subtitle">Prepared by NOVAX Ops · Confidential</div>
      </div>
    </div>
    <div class="report-header-right">
      <div class="client-name">${clientName}</div>
      <div class="period-label">${period}</div>
      <div class="confidential">Not for external distribution</div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <!-- Print button (hidden on print) -->
  <button class="print-btn no-print" onclick="window.print()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
    Print / Save as PDF
  </button>

  <!-- Content -->
  <div class="content">
    ${kpiRows ? `<div class="kpi-grid">${kpiRows}</div>` : ''}
    ${tablesSections}

    <!-- Footer -->
    <div class="footer">
      <span class="footer-logo">NOVAX Ops</span>
      <span>Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      <span>${title} · ${clientName} · ${period}</span>
    </div>
  </div>

  <!-- Auto-trigger print on load -->
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print() }, 500)
    })
  </script>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { tab?: string; clientName?: string; period?: string; data?: ReportData }
  const { tab = 'monthly', clientName = 'Client', period = '', data = {} } = body

  const html = generateReportHTML(tab, clientName, period, data)
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
