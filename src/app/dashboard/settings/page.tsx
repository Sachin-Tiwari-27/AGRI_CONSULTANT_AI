import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/Sidebar";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { BrandingSettingsForm } from "@/components/settings/BrandingSettingsForm";
import { PaymentSettingsForm } from "@/components/settings/PaymentSettingsForm";
import { DangerZone } from "@/components/settings/DangerZone";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  return (
    <div>
      <TopBar title="Settings" />
      <div className="px-8 py-6 max-w-2xl space-y-6">
        <ProfileSettingsForm profile={profile} />
        <BrandingSettingsForm profile={profile} />
        {profile && <PaymentSettingsForm profile={profile} />}
        <DangerZone />
      </div>
    </div>
  );
}
