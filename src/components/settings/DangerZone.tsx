"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
    <Card className="border-red-100">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-red-600" />
          <p className="text-sm font-semibold text-red-900">Danger zone</p>
        </div>

        <Separator className="bg-red-100" />

        {/* Sign out */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-foreground">Sign out</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Sign out from this device.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            loading={signingOut}
            className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
          >
            <LogOut className="size-3.5" /> Sign out
          </Button>
        </div>

        <Separator className="bg-red-100" />

        {/* Deactivate */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-foreground">
              Deactivate account
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Permanently disable your account. This cannot be undone.
            </p>
          </div>
          {!confirmDeactivate ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDeactivate(true)}
              className="flex-shrink-0"
            >
              Deactivate
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
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
      </CardContent>
    </Card>
  );
}
