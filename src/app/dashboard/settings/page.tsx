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
    <div className="flex flex-col h-full">
      <TopBar title="Settings" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
          <ProfileSettingsForm profile={profile} />
          <BrandingSettingsForm profile={profile} />
          {profile && <PaymentSettingsForm profile={profile} />}
          <DangerZone />
        </div>
      </div>
    </div>
  );
}
