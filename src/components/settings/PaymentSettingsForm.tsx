'use client'
import { useState } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, Input, Select } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { CreditCard, Save } from 'lucide-react'
import type { Profile } from '@/types'

interface Props {
  profile: Profile
}

export function PaymentSettingsForm({ profile }: Props) {
  const [loading, setLoading] = useState(false)
  const [preference, setPreference] = useState(profile.payment_preference || 'project_basis')
  const [currency, setCurrency] = useState(profile.default_currency || 'USD')
  const [amount, setAmount] = useState(profile.default_amount?.toString() || '')

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_preference: preference,
          default_currency: currency,
          default_amount: amount ? parseFloat(amount) : null,
        }),
      })
      if (!res.ok) throw new Error('Failed to update')
      alert('Settings saved successfully')
    } catch (err) {
      alert('Error saving settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <CreditCard className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Payment Settings</h2>
          <p className="text-xs text-slate-500">Configure how you charge for reports.</p>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        <Field label="Billing Strategy" helperText="Decide when to trigger the payment requirement.">
          <Select
            value={preference}
            onChange={(e) => setPreference(e.target.value as any)}
            options={[
              { value: 'always_upfront', label: 'Always Charge Upfront (Before Phase 1)' },
              { value: 'project_basis', label: 'On Project Basis (Custom for each client)' },
            ]}
          />
        </Field>

        {preference === 'always_upfront' && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <Field label="Default Currency">
              <Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={[
                  { value: 'OMR', label: 'OMR - Omani Rial' },
                  { value: 'USD', label: 'USD - US Dollar' },
                  { value: 'EUR', label: 'EUR - Euro' },
                  { value: 'AED', label: 'AED - UAE Dirham' },
                  { value: 'SAR', label: 'SAR - Saudi Riyal' },
                  { value: 'KWD', label: 'KWD - Kuwaiti Dinar' },
                  { value: 'BHD', label: 'BHD - Bahraini Dinar' },
                  { value: 'QAR', label: 'QAR - Qatari Riyal' },
                ]}
              />
            </Field>
            <Field label="Amount to Charge">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <Button onClick={handleSave} loading={loading} className="gap-2">
            <Save className="w-4 h-4" />
            Save Payment Settings
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
