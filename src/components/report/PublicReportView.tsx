'use client'
import { useState } from 'react'
import { Card, CardBody } from '@/components/ui/Card'
import { CheckCircle, FileText, TrendingUp, ShieldCheck, BarChart3, Info, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { Report, ReportSectionKey } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const SECTION_ICONS: Record<string, any> = {
  executive_summary: CheckCircle,
  market_analysis: BarChart3,
  business_model: TrendingUp,
  financial_projection: TrendingUp,
  risk_mitigation: ShieldCheck,
  technical_analysis: ShieldCheck,
  conclusion: FileText,
}

const SECTION_TITLES: Record<string, string> = {
  executive_summary: 'Executive Summary',
  market_analysis: 'Market Analysis',
  business_model: 'Business Model',
  financial_projection: 'Financial Projection',
  risk_mitigation: 'Risk & Mitigation',
  technical_analysis: 'Technical Analysis',
  conclusion: 'Conclusion',
}

const FREE_SECTIONS = ['executive_summary']
const CHART_COLORS = ['#1A5C38', '#2E7D52', '#4CAF82', '#7DD3B0', '#A8E6CA']

export function PublicReportView({
  report,
  paid: initialPaid,
  projectId,
}: {
  report: Report
  paid: boolean
  projectId: string
}) {
  const [paid, setPaid] = useState(initialPaid)
  const [paying, setPaying] = useState(false)
  const sectionKeys = Object.keys(SECTION_TITLES).filter(k => report.sections[k as ReportSectionKey])

  const cropChartData = report.financial_model?.crops?.map(c => ({
    name: c.name, revenue: c.annual_revenue,
  })) || []

  const costPieData = report.financial_model ? [
    { name: 'CAPEX', value: report.financial_model.capex_total },
    { name: 'Pre-startup', value: report.financial_model.pre_startup_cost },
    { name: 'Growing costs', value: report.financial_model.growing_cost_annual },
    { name: 'Manpower', value: report.financial_model.manpower_cost_annual },
  ].filter(d => d.value > 0) : []

  async function handleUnlock() {
    setPaying(true)
    try {
      const res = await fetch('/api/payment/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (res.ok) setPaid(true)
    } finally { setPaying(false) }
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-12">
      {/* Branding Header */}
      <div
        className="rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${report.branding.primary_color}, ${report.branding.secondary_color})` }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              Feasibility Study
            </span>
            <h1 className="text-4xl font-extrabold mt-4 mb-2 tracking-tight">Agricultural Project Synthesis</h1>
            <p className="text-white/80 font-medium">Prepared by {report.branding.consultant_name} — {report.branding.company_name}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/10 text-center flex-shrink-0">
            <p className="text-xs opacity-70 uppercase font-bold mb-1">Status</p>
            <p className="text-lg font-bold flex items-center justify-center gap-2">
              {paid
                ? <><Unlock className="w-5 h-5 text-green-300" /> Full Access</>
                : <><Lock className="w-5 h-5 text-amber-300" /> Preview Only</>}
            </p>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-24 -mb-24 blur-2xl" />
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total CAPEX', value: formatCurrency(report.financial_model.capex_total), icon: BarChart3, color: 'text-blue-600' },
          { label: 'Annual Revenue', value: formatCurrency(report.financial_model.total_annual_revenue), icon: TrendingUp, color: 'text-green-600' },
          { label: 'Payback Period', value: `${report.financial_model.payback_years} Years`, icon: Info, color: 'text-purple-600' },
        ].map((item, i) => (
          <Card key={i} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardBody className="flex items-center gap-4 py-6">
              <div className={`p-3 rounded-xl bg-slate-50 ${item.color}`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">{item.label}</p>
                <p className="text-xl font-extrabold text-slate-900">{item.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Report Sections */}
      <div className="space-y-12">
        {sectionKeys.map((key) => {
          const section = report.sections[key as ReportSectionKey]!
          const Icon = SECTION_ICONS[key] || Info
          const isLocked = !paid && !FREE_SECTIONS.includes(key)

          return (
            <section key={key} className="relative scroll-mt-24">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                  isLocked ? 'bg-slate-100 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isLocked ? <Lock className="w-5 h-5" /> : <Icon className="w-6 h-6" />}
                </div>
                <h2 className={`text-2xl font-extrabold tracking-tight ${
                  isLocked ? 'text-slate-400' : 'text-slate-900'
                }`}>
                  {SECTION_TITLES[key]}
                </h2>
                <div className="flex-1 h-px bg-slate-100 ml-4 hidden md:block" />
              </div>

              {isLocked ? (
                <div className="relative">
                  <div className="blur-sm select-none pointer-events-none opacity-60">
                    <MarkdownRenderer content={section.content.slice(0, 400) + '...'} />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white flex flex-col items-center justify-end pb-4">
                    <div className="text-center">
                      <Lock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-600">This section is locked</p>
                    </div>
                  </div>
                </div>
              ) : (
                <MarkdownRenderer content={section.content} />
              )}

              {/* Financial charts inside financial_projection section */}
              {key === 'financial_projection' && !isLocked && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  {cropChartData.length > 0 && (
                    <Card className="border-slate-100">
                      <CardBody>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Crop Revenue Breakdown</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={cropChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${((v as number)/1000).toFixed(0)}K`} />
                            <Tooltip formatter={(v) => formatCurrency(v as number)} />
                            <Bar dataKey="revenue" fill="#1A5C38" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardBody>
                    </Card>
                  )}
                  {costPieData.length > 0 && (
                    <Card className="border-slate-100">
                      <CardBody>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Investment Breakdown</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={costPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                              {costPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v) => formatCurrency(v as number)} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardBody>
                    </Card>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* Pay to Unlock CTA */}
      {!paid && (
        <div className="sticky bottom-0 bg-white border-t border-slate-200 shadow-lg p-6 rounded-t-3xl">
          <div className="max-w-lg mx-auto flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1">
              <p className="font-bold text-slate-900">Unlock the Full Report</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Get access to {sectionKeys.length - FREE_SECTIONS.length} more sections including financial projections, market analysis, and risk assessment.
              </p>
            </div>
            <Button onClick={handleUnlock} loading={paying} size="lg" className="flex-shrink-0">
              <Unlock className="w-4 h-4" /> Pay to Unlock — {formatCurrency(report.financial_model.capex_total > 500000 ? 4999 : 2499)}
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="pt-10 pb-10 border-t border-slate-100 text-center">
        <p className="text-slate-400 text-sm">
          © {new Date().getFullYear()} {report.branding.company_name}. All rights reserved.<br />
          Confidential Business Intelligence Report.
        </p>
      </footer>
    </div>
  )
}
