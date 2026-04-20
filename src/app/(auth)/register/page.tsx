'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/FormFields'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '', email: '', password: '',
    company_name: '', role: 'consultant',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          company_name: form.company_name,
          role: form.role,
        },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Create your account</h2>
      <p className="text-sm text-slate-500 mb-6">Start your first AgriAI project today</p>

      <form onSubmit={handleRegister} className="space-y-4">
        <Field label="Full name" required>
          <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Muraleemanohar M." required />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="murali@farmtechconsultancy.com" required />
        </Field>
        <Field label="Company / Organisation">
          <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Tech Farming International" />
        </Field>
        <Field label="I am a" required>
          <Select
            value={form.role}
            onChange={e => set('role', e.target.value)}
            options={[
              { value: 'consultant', label: 'Consultant / Expert' },
              { value: 'client', label: 'Farmer / Investor' },
            ]}
          />
        </Field>
        <Field label="Password" required>
          <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" required minLength={8} />
        </Field>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">Create account</Button>
      </form>

      <p className="text-sm text-slate-500 text-center mt-5">
        Already have an account?{' '}
        <Link href="/login" className="text-green-700 font-medium hover:underline">Sign in</Link>
      </p>
    </>
  )
}
