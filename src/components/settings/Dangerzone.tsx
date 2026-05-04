"use client";
import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogOut } from "lucide-react";

export function DangerZone() {
  const router = useRouter();
  const supabase = createClient();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <Card className="border-red-100 bg-red-50/30">
      <CardBody className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <p className="text-sm font-semibold text-red-900">Danger zone</p>
        </div>

        {/* Sign out */}
        <div className="flex items-center justify-between py-3 border-b border-red-100">
          <div>
            <p className="text-sm font-medium text-red-900">Sign out</p>
            <p className="text-xs text-red-700 mt-0.5">
              Sign out from this device.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            loading={signingOut}
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </Button>
        </div>

        {/* Deactivate */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-900">
              Deactivate account
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              Permanently disable your account. This cannot be undone.
            </p>
          </div>
          {!confirmDeactivate ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDeactivate(true)}
            >
              Deactivate
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xs text-red-700 font-medium">Are you sure?</p>
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  alert("Contact support to deactivate your account.")
                }
              >
                Yes, deactivate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeactivate(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
