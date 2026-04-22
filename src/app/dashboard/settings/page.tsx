import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/Sidebar'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { PaymentSettingsForm } from '@/components/settings/PaymentSettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user!.id).single()

  return (
    <div>
      <TopBar title="Settings" />

      <div className="px-8 py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">Profile Settings</h2>
            <p className="text-xs text-slate-500 mt-1">Manage your consultant profile and contact information.</p>
          </CardHeader>
          <CardBody className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name">
                <Input defaultValue={profile?.full_name} disabled />
              </Field>
              <Field label="Email Address">
                <Input defaultValue={profile?.email} disabled />
              </Field>
              <Field label="Company Name">
                <Input defaultValue={profile?.company_name || 'Tech Farming International'} disabled />
              </Field>
              <Field label="Phone Number">
                <Input defaultValue={profile?.phone || '+968 XXXX XXXX'} placeholder="Add phone number" />
              </Field>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button disabled>Save Changes</Button>
            </div>
            
            <p className="text-[10px] text-slate-400 italic">
              Note: Name and Email can only be updated via the Admin panel.
            </p>
          </CardBody>
        </Card>

        {profile && <PaymentSettingsForm profile={profile} />}

        <Card className="mt-6 border-red-100 bg-red-50/30">
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-900">Danger Zone</p>
              <p className="text-xs text-red-700 mt-0.5">Logout from all devices or deactivate account.</p>
            </div>
            <Button variant="danger" size="sm">Deactivate</Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
