import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { ClientQuestionnaireForm } from '@/components/questionnaire/ClientQuestionnaireForm'

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createServiceClient()

  const { data: submission } = await supabase
    .from('questionnaire_submissions')
    .select('*')
    .eq('token', token)
    .single()

  if (!submission) notFound()

  // Already submitted
  if (submission.submitted_at) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Already submitted</h1>
          <p className="text-slate-600 text-sm">
            This questionnaire has already been submitted. Your consultant will be in touch shortly.
          </p>
        </div>
      </div>
    )
  }

  const { data: template } = await supabase
    .from('questionnaire_templates')
    .select('*')
    .eq('id', submission.template_id)
    .single()

  // If no template exists yet, use the default FTC template
  const defaultTemplate = {
    id: 'default',
    consultant_id: '',
    name: 'Project Scoping Questionnaire',
    sections: [
      { id: 's1', title: 'Investor & Site Profile', order: 1 },
      { id: 's2', title: 'Infrastructure & Utilities', order: 2 },
      { id: 's3', title: 'Project Vision & Crops', order: 3 },
      { id: 's4', title: 'Commercial & Logistics', order: 4 },
    ],
    questions: [
      // Section 1
      { id: 'q1', section_id: 's1', label: 'Legal entity or company name', type: 'text' as const, required: true, order: 1 },
      { id: 'q2', section_id: 's1', label: 'Primary contact person', type: 'text' as const, required: true, order: 2 },
      { id: 'q3', section_id: 's1', label: 'Email / WhatsApp', type: 'text' as const, required: true, order: 3 },
      { id: 'q4', section_id: 's1', label: 'GPS coordinates or Google Maps link', type: 'gps' as const, required: true, order: 4,
        helper_text: 'This allows us to pull accurate climate data for your location' },
      { id: 'q5', section_id: 's1', label: 'Total land area available (sqm)', type: 'number' as const, required: true, order: 5 },
      // Section 2
      { id: 'q6', section_id: 's2', label: 'Primary water source', type: 'select' as const, required: true, order: 1,
        options: [
          { value: 'deep_well', label: 'Deep well' },
          { value: 'desalination', label: 'Desalination plant' },
          { value: 'tanker', label: 'Water tanker' },
          { value: 'government', label: 'Government supply' },
        ]
      },
      { id: 'q7', section_id: 's2', label: 'Estimated water availability (litres/day)', type: 'number' as const, required: true, order: 2 },
      { id: 'q8', section_id: 's2', label: 'Water analysis report available?', type: 'boolean' as const, required: true, order: 3,
        helper_text: 'EC/TDS/pH data is mandatory for hydroponic projects. If you have it, please attach below.' },
      { id: 'q9', section_id: 's2', label: 'Upload water analysis report (if available)', type: 'file_upload' as const, required: false, order: 4,
        conditions: [{ question_id: 'q8', operator: 'is_true' as const, value: 'true' }]
      },
      { id: 'q10', section_id: 's2', label: 'Power source', type: 'select' as const, required: true, order: 5,
        options: [
          { value: 'grid', label: 'Government grid (Nama/Mazoon)' },
          { value: 'generator', label: 'Diesel generator' },
          { value: 'solar', label: 'Solar/hybrid' },
        ]
      },
      { id: 'q11', section_id: 's2', label: 'Available power capacity (KVA)', type: 'number' as const, required: false, order: 6 },
      { id: 'q12', section_id: 's2', label: 'Internet connectivity at site', type: 'select' as const, required: true, order: 7,
        options: [
          { value: '4g_5g', label: '4G / 5G available' },
          { value: 'weak', label: 'Weak signal' },
          { value: 'none', label: 'No signal' },
        ]
      },
      { id: 'q13', section_id: 's2', label: 'Can a 40ft container truck reach the site?', type: 'boolean' as const, required: true, order: 8 },
      // Section 3
      { id: 'q14', section_id: 's3', label: 'Target crops', type: 'multiselect' as const, required: true, order: 1,
        options: [
          { value: 'cherry_tomato', label: 'Cherry / Snack Tomatoes' },
          { value: 'beef_tomato', label: 'Beef Tomatoes' },
          { value: 'capsicum', label: 'Bell Peppers (Capsicum)' },
          { value: 'cucumber', label: 'Snack Cucumbers' },
          { value: 'lettuce', label: 'Leafy Lettuce' },
          { value: 'herbs', label: 'Herbs' },
          { value: 'strawberry', label: 'Strawberries' },
          { value: 'fig', label: 'Figs' },
          { value: 'other', label: 'Other' },
        ]
      },
      { id: 'q15', section_id: 's3', label: 'Specify other crops', type: 'text' as const, required: false, order: 2,
        conditions: [{ question_id: 'q14', operator: 'contains' as const, value: 'other' }]
      },
      { id: 'q16', section_id: 's3', label: 'Desired technology level', type: 'select' as const, required: true, order: 3,
        options: [
          { value: 'standard', label: 'Standard — naturally ventilated, manual controls' },
          { value: 'advanced', label: 'Advanced — climate sensors, high-pressure fogging' },
          { value: 'elite', label: 'Elite — fully automated closed-loop system' },
        ]
      },
      { id: 'q17', section_id: 's3', label: 'Is agro-tourism / farm experience planned?', type: 'boolean' as const, required: true, order: 4 },
      // Section 4
      { id: 'q18', section_id: 's4', label: 'Primary target market', type: 'multiselect' as const, required: true, order: 1,
        options: [
          { value: 'local_retail', label: 'Local retail / traders' },
          { value: 'supermarkets', label: 'Supermarkets / hypermarkets' },
          { value: 'restaurants', label: 'Restaurants & hotels' },
          { value: 'export_uae', label: 'Export to UAE' },
          { value: 'export_gcc', label: 'Export to GCC' },
        ]
      },
      { id: 'q19', section_id: 's4', label: 'On-site cold storage required?', type: 'boolean' as const, required: true, order: 2 },
      { id: 'q20', section_id: 's4', label: 'Allocated budget for Phase 1 (USD or OMR)', type: 'text' as const, required: true, order: 3,
        placeholder: 'e.g. OMR 500,000 or USD 1.3M' },
      { id: 'q21', section_id: 's4', label: 'Target construction start date', type: 'date' as const, required: false, order: 4 },
      { id: 'q22', section_id: 's4', label: 'Any other information or specific requirements', type: 'textarea' as const, required: false, order: 5 },
    ],
    created_at: new Date().toISOString(),
  }

  return (
    <ClientQuestionnaireForm
      submission={submission}
      template={template || defaultTemplate}
    />
  )
}
