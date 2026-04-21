'use client'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { CheckCircle, FileText, TrendingUp, ShieldCheck, Map, BarChart3, Info } from 'lucide-react'
import type { Report, ReportSectionKey } from '@/types'
import { formatCurrency } from '@/lib/utils'

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

export function PublicReportView({ report }: { report: Report }) {
  const sectionKeys = Object.keys(SECTION_TITLES).filter(k => report.sections[k as ReportSectionKey])

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
              <CheckCircle className="w-5 h-5 text-green-300" />
              Published
            </p>
          </div>
        </div>
        {/* Abstract background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-24 -mb-24 blur-2xl" />
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total CAPEX', value: formatCurrency(report.financial_model.capex_total), icon: Map, color: 'text-blue-600' },
          { label: 'Annual Revenue', value: formatCurrency(report.financial_model.total_annual_revenue), icon: TrendingUp, color: 'text-green-600' },
          { label: 'Payback Period', value: `${report.financial_model.payback_years} Years`, icon: BarChart3, color: 'text-purple-600' },
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
      <div className="space-y-16">
        {sectionKeys.map((key) => {
          const section = report.sections[key as ReportSectionKey]!
          const Icon = SECTION_ICONS[key] || Info

          return (
            <section key={key} className="relative scroll-mt-24">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shadow-sm">
                  <Icon className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {SECTION_TITLES[key]}
                </h2>
                <div className="flex-1 h-px bg-slate-100 ml-4 hidden md:block" />
              </div>
              <div className="prose prose-lg max-w-none text-slate-700 leading-relaxed space-y-4">
                {section.content.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Footer */}
      <footer className="pt-20 pb-10 border-t border-slate-100 text-center">
        <p className="text-slate-400 text-sm">
          © {new Date().getFullYear()} {report.branding.company_name}. All rights reserved.<br />
          Confidential Business Intelligence Report.
        </p>
      </footer>
    </div>
  )
}
