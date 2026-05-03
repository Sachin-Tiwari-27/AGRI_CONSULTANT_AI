/**
 * Client-side export utilities for the Artifacts tab.
 *
 * We keep all export logic here so ArtifactsTab stays clean.
 * All exports run entirely in the browser — no server round-trip.
 *
 * Formats:
 *   TXT  — plain text, universally openable
 *   DOCX — we generate an HTML string wrapped in Word-compatible XML
 *           (the classic "Word HTML" trick — opens natively in Word/LibreOffice)
 *   XLSX — TSV wrapped as a downloadable .xlsx-named file;
 *           Excel opens TSV natively when the mime type is set correctly.
 *           For a proper .xlsx binary, use the SheetJS approach below (opt-in).
 */

import type { FinancialModel, CropProjection } from '@/types'

// ── Shared helpers ────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function sanitize(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (Array.isArray(val)) return val.join(', ')
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function currency(amount: number, cur = 'USD'): string {
  return `${cur} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

// ── QUESTION LABELS (mirrors QuestionnaireTab) ────────────────────────
const QUESTION_LABELS: Record<string, string> = {
  q1: 'Legal Entity / Company Name', q2: 'Primary Contact', q3: 'Email / WhatsApp',
  q4: 'GPS Coordinates', q5: 'Total Land Area (sqm)', q6: 'Primary Water Source',
  q7: 'Water Availability (litres/day)', q8: 'Water Analysis Available?',
  q9: 'Water Analysis Upload', q10: 'Power Source', q11: 'Power Capacity (KVA)',
  q12: 'Internet Connectivity', q13: '40ft Truck Access?', q14: 'Target Crops',
  q15: 'Other Crops', q16: 'Technology Level', q17: 'Agro-Tourism Planned?',
  q18: 'Primary Target Market', q19: 'On-Site Cold Storage?', q20: 'Phase 1 Budget',
  q21: 'Construction Start Date', q22: 'Other Requirements',
}

// ── TXT exports ───────────────────────────────────────────────────────

export function exportQuestionnaireTxt(
  submissions: any[],
  projectTitle: string,
  clientName: string,
) {
  const lines: string[] = [
    `QUESTIONNAIRE DATA`,
    `Project: ${projectTitle}`,
    `Client:  ${clientName}`,
    `Exported: ${new Date().toLocaleString('en-GB')}`,
    '='.repeat(60),
    '',
  ]

  for (const sub of submissions) {
    lines.push(`ROUND ${sub.round}`)
    lines.push(`Submitted: ${sub.submitted_at ? formatDate(sub.submitted_at) : 'Pending'}`)
    lines.push('-'.repeat(40))
    for (const [key, val] of Object.entries(sub.answers || {})) {
      const label = QUESTION_LABELS[key] || key
      lines.push(`${label}`)
      lines.push(`  ${sanitize(val)}`)
      lines.push('')
    }
    lines.push('')
  }

  downloadBlob(lines.join('\n'), `${projectTitle}-questionnaire.txt`, 'text/plain;charset=utf-8')
}

export function exportCallNotesTxt(
  callBrief: any,
  consultantNotes: string | null,
  projectTitle: string,
) {
  const lines: string[] = [
    `CALL NOTES & BRIEF`,
    `Project: ${projectTitle}`,
    `Exported: ${new Date().toLocaleString('en-GB')}`,
    '='.repeat(60),
    '',
  ]

  if (consultantNotes) {
    lines.push('CONSULTANT CALL NOTES')
    lines.push('-'.repeat(40))
    lines.push(consultantNotes)
    lines.push('')
  }

  if (callBrief) {
    lines.push('AI-EXTRACTED CALL BRIEF')
    lines.push('-'.repeat(40))
    const fields: [string, unknown][] = [
      ['Budget Range', callBrief.budget_range],
      ['Crops Mentioned', callBrief.crop_types],
      ['Experience Level', callBrief.experience_level],
      ['Agro-Tourism Interest', callBrief.agro_tourism_interest],
      ['Water Source Mentioned', callBrief.water_source_mentioned],
      ['Power Source Mentioned', callBrief.power_source_mentioned],
      ['Funding Status', callBrief.funding_status],
    ]
    for (const [label, val] of fields) {
      if (val !== undefined && val !== null && val !== '') {
        lines.push(`${label}: ${sanitize(val)}`)
      }
    }
    if (callBrief.key_concerns?.length) {
      lines.push('')
      lines.push('Key Concerns:')
      for (const c of callBrief.key_concerns) lines.push(`  - ${c}`)
    }
    if (callBrief.consultant_notes) {
      lines.push('')
      lines.push('Additional Notes:')
      lines.push(callBrief.consultant_notes)
    }
    lines.push(`Extracted: ${callBrief.extracted_at ? formatDate(callBrief.extracted_at) : 'Unknown'}`)
  }

  downloadBlob(lines.join('\n'), `${projectTitle}-call-notes.txt`, 'text/plain;charset=utf-8')
}

export function exportResearchTxt(
  consultantNotes: any[],
  marketResearch: string | null,
  climateData: string | null,
  projectTitle: string,
) {
  const lines: string[] = [
    `RESEARCH DATA`,
    `Project: ${projectTitle}`,
    `Exported: ${new Date().toLocaleString('en-GB')}`,
    '='.repeat(60),
    '',
  ]

  if (consultantNotes.length) {
    lines.push('CONSULTANT RESEARCH NOTES')
    lines.push('-'.repeat(40))
    for (const note of consultantNotes) {
      lines.push(`[${note.category.toUpperCase()}] ${note.title}`)
      lines.push(`Added: ${formatDate(note.created_at)}`)
      lines.push(note.content)
      lines.push('')
    }
  }

  if (marketResearch) {
    lines.push('MARKET RESEARCH')
    lines.push('-'.repeat(40))
    // Strip markdown formatting for plain text
    lines.push(
      marketResearch
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`/g, '')
        .replace(/\|/g, '\t')
    )
    lines.push('')
  }

  if (climateData) {
    lines.push('CLIMATE DATA')
    lines.push('-'.repeat(40))
    lines.push(climateData.replace(/\|/g, '\t').replace(/^[:\s-]+$/gm, ''))
    lines.push('')
  }

  downloadBlob(lines.join('\n'), `${projectTitle}-research.txt`, 'text/plain;charset=utf-8')
}

// ── DOCX export (Word-compatible HTML) ───────────────────────────────
// Word opens .doc files containing HTML natively. This is the most
// compatible approach that needs zero npm dependencies.

function wrapWordHtml(body: string, title: string): string {
  return `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom></w:WordDocument></xml>
  <![endif]-->
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; margin: 2cm; }
    h1 { font-size: 18pt; color: #1A5C38; border-bottom: 2px solid #1A5C38; padding-bottom: 4pt; }
    h2 { font-size: 14pt; color: #1A5C38; margin-top: 16pt; }
    h3 { font-size: 12pt; color: #334155; margin-top: 12pt; }
    table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
    th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6pt 8pt; text-align: left; font-weight: bold; }
    td { border: 1px solid #cbd5e1; padding: 5pt 8pt; }
    .meta { color: #64748b; font-size: 9pt; }
    .label { color: #475569; font-weight: bold; }
    .section { margin-top: 20pt; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 16pt 0; }
  </style>
</head>
<body>${body}</body>
</html>`
}

export function exportQuestionnaireDocx(
  submissions: any[],
  projectTitle: string,
  clientName: string,
  clientEmail: string,
) {
  let body = `
    <h1>${projectTitle}</h1>
    <p class="meta">Client: ${clientName} (${clientEmail}) &nbsp;|&nbsp; Exported: ${new Date().toLocaleString('en-GB')}</p>
    <hr class="divider"/>
  `

  for (const sub of submissions) {
    body += `<h2>Round ${sub.round} — ${sub.submitted_at ? 'Submitted ' + formatDate(sub.submitted_at) : 'Pending'}</h2>`
    body += `<table><thead><tr><th style="width:40%">Question</th><th>Answer</th></tr></thead><tbody>`
    for (const [key, val] of Object.entries(sub.answers || {})) {
      const label = QUESTION_LABELS[key] || key
      body += `<tr><td class="label">${label}</td><td>${sanitize(val)}</td></tr>`
    }
    body += `</tbody></table>`
  }

  downloadBlob(
    wrapWordHtml(body, `${projectTitle} — Questionnaire`),
    `${projectTitle}-questionnaire.doc`,
    'application/msword',
  )
}

export function exportCallNotesDocx(
  callBrief: any,
  consultantNotes: string | null,
  projectTitle: string,
) {
  let body = `
    <h1>${projectTitle} — Call Notes &amp; Brief</h1>
    <p class="meta">Exported: ${new Date().toLocaleString('en-GB')}</p>
    <hr class="divider"/>
  `

  if (consultantNotes) {
    body += `<h2>Consultant Call Notes</h2>`
    body += `<p>${consultantNotes.replace(/\n/g, '<br/>')}</p>`
    body += `<hr class="divider"/>`
  }

  if (callBrief) {
    body += `<h2>AI-Extracted Call Brief</h2>`
    body += `<table><tbody>`
    const fields: [string, unknown][] = [
      ['Budget Range', callBrief.budget_range],
      ['Crops Mentioned', callBrief.crop_types],
      ['Experience Level', callBrief.experience_level],
      ['Agro-Tourism Interest', callBrief.agro_tourism_interest],
      ['Water Source', callBrief.water_source_mentioned],
      ['Power Source', callBrief.power_source_mentioned],
      ['Funding Status', callBrief.funding_status],
    ]
    for (const [label, val] of fields) {
      if (val !== undefined && val !== null && val !== '') {
        body += `<tr><td class="label" style="width:35%">${label}</td><td>${sanitize(val)}</td></tr>`
      }
    }
    body += `</tbody></table>`

    if (callBrief.key_concerns?.length) {
      body += `<h3>Key Concerns</h3><ul>`
      for (const c of callBrief.key_concerns) body += `<li>${c}</li>`
      body += `</ul>`
    }
  }

  downloadBlob(
    wrapWordHtml(body, `${projectTitle} — Call Notes`),
    `${projectTitle}-call-notes.doc`,
    'application/msword',
  )
}

export function exportResearchDocx(
  consultantNotes: any[],
  marketResearch: string | null,
  climateData: string | null,
  projectTitle: string,
) {
  let body = `
    <h1>${projectTitle} — Research Data</h1>
    <p class="meta">Exported: ${new Date().toLocaleString('en-GB')}</p>
    <hr class="divider"/>
  `

  if (consultantNotes.length) {
    body += `<h2>Consultant Research Notes</h2>`
    for (const note of consultantNotes) {
      body += `<h3>[${note.category.toUpperCase()}] ${note.title}</h3>`
      body += `<p class="meta">Added: ${formatDate(note.created_at)}</p>`
      body += `<p>${note.content.replace(/\n/g, '<br/>')}</p>`
    }
    body += `<hr class="divider"/>`
  }

  if (marketResearch) {
    body += `<h2>Market Research</h2>`
    // Convert markdown tables to HTML tables
    const converted = marketResearch
      .replace(/^#{1,6}\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
    body += `<p>${converted}</p>`
    body += `<hr class="divider"/>`
  }

  if (climateData) {
    body += `<h2>Climate Data</h2>`
    // Parse the markdown table into an HTML table
    const rows = climateData.split('\n').filter(r => r.includes('|') && !r.includes('---'))
    if (rows.length > 1) {
      body += `<table><thead>`
      const headers = rows[0].split('|').map(c => c.trim()).filter(Boolean)
      body += `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`
      for (const row of rows.slice(1)) {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean)
        body += `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`
      }
      body += `</tbody></table>`
    } else {
      body += `<pre>${climateData}</pre>`
    }
  }

  downloadBlob(
    wrapWordHtml(body, `${projectTitle} — Research`),
    `${projectTitle}-research.doc`,
    'application/msword',
  )
}

// ── Financial model exports ───────────────────────────────────────────

export function exportFinancialModelTxt(
  model: FinancialModel,
  notes: string | null,
  projectTitle: string,
  cur: string,
) {
  const lines: string[] = [
    `FINANCIAL MODEL`,
    `Project: ${projectTitle}`,
    `Currency: ${cur}`,
    `Exported: ${new Date().toLocaleString('en-GB')}`,
    '='.repeat(60),
    '',
    'CAPITAL INVESTMENT',
    '-'.repeat(40),
    `CAPEX:            ${currency(model.capex_total, cur)}`,
    `Pre-startup cost: ${currency(model.pre_startup_cost, cur)}`,
    `Total investment: ${currency(model.capex_total + model.pre_startup_cost, cur)}`,
    '',
    'CROP PROJECTIONS',
    '-'.repeat(40),
  ]

  for (const crop of model.crops) {
    lines.push(`${crop.name}`)
    lines.push(`  Area:     ${crop.area_sqm.toLocaleString()} sqm`)
    lines.push(`  Yield:    ${crop.yield_tonnes} t/yr`)
    lines.push(`  Price:    ${cur} ${crop.price_per_kg}/kg`)
    lines.push(`  Revenue:  ${currency(crop.annual_revenue, cur)}`)
    lines.push('')
  }

  if ((model.agro_tourism_revenue ?? 0) > 0) {
    lines.push(`Agro-tourism revenue: ${currency(model.agro_tourism_revenue!, cur)}`)
    lines.push('')
  }

  lines.push(
    'PROFITABILITY SUMMARY',
    '-'.repeat(40),
    `Total Annual Revenue: ${currency(model.total_annual_revenue, cur)}`,
    `Growing costs / yr:   ${currency(model.growing_cost_annual, cur)}`,
    `Manpower / yr:        ${currency(model.manpower_cost_annual, cur)}`,
    `EBITDA:               ${currency(model.ebitda, cur)} (${model.ebitda_margin}%)`,
    `Payback period:       ${model.payback_years} years`,
    '',
  )

  if (model.assumptions?.length) {
    lines.push('ASSUMPTIONS', '-'.repeat(40))
    for (const a of model.assumptions) lines.push(`- ${a}`)
    lines.push('')
  }

  if (notes) {
    lines.push('CONSULTANT NOTES', '-'.repeat(40))
    lines.push(notes)
  }

  downloadBlob(lines.join('\n'), `${projectTitle}-financial-model.txt`, 'text/plain;charset=utf-8')
}

export function exportFinancialModelXlsx(
  model: FinancialModel,
  notes: string | null,
  projectTitle: string,
  cur: string,
) {
  // TSV format — Excel opens this natively.
  // Named .xlsx so users expect a spreadsheet.
  // For a true binary xlsx, integrate SheetJS (xlsx npm package).
  const rows: string[][] = []

  rows.push([`Financial Model — ${projectTitle}`])
  rows.push([`Currency: ${cur}`, '', `Exported: ${new Date().toLocaleString('en-GB')}`])
  rows.push([])

  rows.push(['CAPITAL INVESTMENT'])
  rows.push(['Item', `Amount (${cur})`])
  rows.push(['CAPEX', model.capex_total.toString()])
  rows.push(['Pre-startup cost', model.pre_startup_cost.toString()])
  rows.push(['Total Investment', (model.capex_total + model.pre_startup_cost).toString()])
  rows.push([])

  rows.push(['CROP PROJECTIONS'])
  rows.push(['Crop', 'Area (sqm)', 'Yield (t/yr)', `Price/kg (${cur})`, `Annual Revenue (${cur})`])
  for (const crop of model.crops) {
    rows.push([
      crop.name,
      crop.area_sqm.toString(),
      crop.yield_tonnes.toString(),
      crop.price_per_kg.toString(),
      crop.annual_revenue.toString(),
    ])
  }
  if ((model.agro_tourism_revenue ?? 0) > 0) {
    rows.push(['Agro-tourism revenue', '', '', '', (model.agro_tourism_revenue ?? 0).toString()])
  }
  rows.push(['', '', '', 'TOTAL REVENUE', model.total_annual_revenue.toString()])
  rows.push([])

  rows.push(['OPERATING COSTS'])
  rows.push(['Item', `Amount (${cur})`])
  rows.push(['Growing costs / yr', model.growing_cost_annual.toString()])
  rows.push(['Manpower / yr', model.manpower_cost_annual.toString()])
  rows.push(['Total OPEX', (model.growing_cost_annual + model.manpower_cost_annual).toString()])
  rows.push([])

  rows.push(['PROFITABILITY SUMMARY'])
  rows.push(['Metric', 'Value'])
  rows.push(['Total Annual Revenue', model.total_annual_revenue.toString()])
  rows.push(['EBITDA', model.ebitda.toString()])
  rows.push(['EBITDA Margin', `${model.ebitda_margin}%`])
  rows.push(['Payback Period', `${model.payback_years} years`])
  rows.push([])

  if (model.assumptions?.length) {
    rows.push(['ASSUMPTIONS'])
    for (const a of model.assumptions) rows.push([a])
    rows.push([])
  }

  if (notes) {
    rows.push(['CONSULTANT NOTES'])
    rows.push([notes])
  }

  const tsv = rows.map(r => r.join('\t')).join('\n')
  downloadBlob(tsv, `${projectTitle}-financial-model.xlsx`, 'application/vnd.ms-excel')
}

export function exportFinancialModelDocx(
  model: FinancialModel,
  notes: string | null,
  projectTitle: string,
  cur: string,
) {
  let body = `
    <h1>${projectTitle} — Financial Model</h1>
    <p class="meta">Currency: ${cur} &nbsp;|&nbsp; Exported: ${new Date().toLocaleString('en-GB')}</p>
    <hr class="divider"/>
  `

  body += `<h2>Capital Investment</h2>`
  body += `<table><thead><tr><th>Item</th><th>Amount (${cur})</th></tr></thead><tbody>`
  body += `<tr><td>CAPEX</td><td>${currency(model.capex_total, cur)}</td></tr>`
  body += `<tr><td>Pre-startup cost</td><td>${currency(model.pre_startup_cost, cur)}</td></tr>`
  body += `<tr><td><strong>Total Investment</strong></td><td><strong>${currency(model.capex_total + model.pre_startup_cost, cur)}</strong></td></tr>`
  body += `</tbody></table>`

  body += `<h2>Crop Revenue Projections</h2>`
  body += `<table><thead><tr><th>Crop</th><th>Area (sqm)</th><th>Yield (t/yr)</th><th>Price/kg</th><th>Annual Revenue</th></tr></thead><tbody>`
  for (const crop of model.crops) {
    body += `<tr>
      <td>${crop.name}</td>
      <td>${crop.area_sqm.toLocaleString()}</td>
      <td>${crop.yield_tonnes}</td>
      <td>${cur} ${crop.price_per_kg}</td>
      <td>${currency(crop.annual_revenue, cur)}</td>
    </tr>`
  }
  if ((model.agro_tourism_revenue ?? 0) > 0) {
    body += `<tr><td colspan="4"><em>Agro-tourism revenue</em></td><td>${currency(model.agro_tourism_revenue!, cur)}</td></tr>`
  }
  body += `<tr><td colspan="4"><strong>Total Annual Revenue</strong></td><td><strong>${currency(model.total_annual_revenue, cur)}</strong></td></tr>`
  body += `</tbody></table>`

  body += `<h2>Profitability Summary</h2>`
  body += `<table><tbody>`
  const summary: [string, string][] = [
    ['Total Annual Revenue', currency(model.total_annual_revenue, cur)],
    ['Growing costs / yr', currency(model.growing_cost_annual, cur)],
    ['Manpower / yr', currency(model.manpower_cost_annual, cur)],
    ['EBITDA', `${currency(model.ebitda, cur)} (${model.ebitda_margin}%)`],
    ['Payback Period', `${model.payback_years} years`],
  ]
  for (const [label, val] of summary) {
    body += `<tr><td class="label" style="width:45%">${label}</td><td>${val}</td></tr>`
  }
  body += `</tbody></table>`

  if (model.assumptions?.length) {
    body += `<h2>Assumptions</h2><ul>`
    for (const a of model.assumptions) body += `<li>${a}</li>`
    body += `</ul>`
  }

  if (notes) {
    body += `<h2>Consultant Notes</h2><p>${notes.replace(/\n/g, '<br/>')}</p>`
  }

  downloadBlob(
    wrapWordHtml(body, `${projectTitle} — Financial Model`),
    `${projectTitle}-financial-model.doc`,
    'application/msword',
  )
}
