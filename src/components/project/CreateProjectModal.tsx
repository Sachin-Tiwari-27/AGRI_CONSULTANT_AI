'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/FormFields'
import { X, Plus } from 'lucide-react'

const schema = z.object({
  title: z.string().min(3, 'Title is required'),
  client_name: z.string().min(2, 'Client name is required'),
  client_email: z.string().email('Valid email required'),
  region: z.string().optional(),
  country: z.string().optional(),
  gps_coordinates: z.string().optional(),
  land_size_sqm: z.string().optional(),
  project_type: z.string().optional(),
  budget_range: z.string().optional(),
  experience_level: z.string().optional(),
  consultant_notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const CROP_OPTIONS = [
  'Cherry Tomato', 'Beef Tomato', 'Capsicum', 'Cucumber', 'Lettuce',
  'Herbs', 'Strawberry', 'Microgreens', 'Fig', 'Chilli', 'Eggplant',
]

export function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedCrops, setSelectedCrops] = useState<string[]>([])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function toggleCrop(crop: string) {
    setSelectedCrops(prev =>
      prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]
    )
  }

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          land_size_sqm: data.land_size_sqm ? parseFloat(data.land_size_sqm) : undefined,
          crop_types: selectedCrops,
        }),
      })
      const project = await res.json()
      if (!res.ok) throw new Error(project.error)
      router.push(`/project/${project.id}`)
    } catch (err) {
      alert('Failed to create project. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold text-slate-900">New project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-5">
          {/* Client info */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Client</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Project title" error={errors.title?.message} required>
                <Input {...register('title')} placeholder="e.g. Al Hamra Greenhouse Farm" />
              </Field>
              <Field label="Client name" error={errors.client_name?.message} required>
                <Input {...register('client_name')} placeholder="Ahmed Al Abri" />
              </Field>
              <Field label="Client email" error={errors.client_email?.message} required>
                <Input {...register('client_email')} type="email" placeholder="client@example.com" className="col-span-2" />
              </Field>
            </div>
          </div>

          {/* Site info */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Site</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Region / City">
                <Input {...register('region')} placeholder="Al Hamra" />
              </Field>
              <Field label="Country">
                <Input {...register('country')} placeholder="Oman" />
              </Field>
              <Field label="GPS coordinates" hint="Paste from Google Maps">
                <Input {...register('gps_coordinates')} placeholder="23.1234, 57.5678" />
              </Field>
              <Field label="Land size (sqm)">
                <Input {...register('land_size_sqm')} type="number" placeholder="38486" />
              </Field>
            </div>
          </div>

          {/* Project type */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Project</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Project type">
                <Select
                  {...register('project_type')}
                  options={[
                    { value: 'greenhouse_turnkey', label: 'Greenhouse Turnkey' },
                    { value: 'expansion', label: 'Expansion' },
                    { value: 'feasibility_only', label: 'Feasibility Only' },
                    { value: 'agro_tourism', label: 'Agro-Tourism' },
                  ]}
                  placeholder="Select type"
                />
              </Field>
              <Field label="Client experience">
                <Select
                  {...register('experience_level')}
                  options={[
                    { value: 'first_time', label: 'First-time grower' },
                    { value: '1_3_years', label: '1–3 years' },
                    { value: '3_6_years', label: '3–6 years' },
                    { value: '6_plus_years', label: '6+ years' },
                  ]}
                  placeholder="Select experience"
                />
              </Field>
              <Field label="Budget range">
                <Input {...register('budget_range')} placeholder="e.g. OMR 500,000 – 800,000" className="col-span-2" />
              </Field>
            </div>
          </div>

          {/* Crops */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Target crops</h3>
            <div className="flex flex-wrap gap-2">
              {CROP_OPTIONS.map(crop => (
                <button
                  key={crop}
                  type="button"
                  onClick={() => toggleCrop(crop)}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    selectedCrops.includes(crop)
                      ? 'bg-green-800 text-white border-green-800'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-green-400'
                  }`}
                >
                  {crop}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <Field label="Call notes / brief">
            <Textarea
              {...register('consultant_notes')}
              placeholder="Key points from the intro conversation..."
              className="min-h-[80px]"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              <Plus className="w-4 h-4" />
              Create project
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
