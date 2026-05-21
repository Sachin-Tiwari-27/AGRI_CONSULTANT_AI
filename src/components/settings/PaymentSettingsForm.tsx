"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/status";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Info,
  ExternalLink,
  Zap,
} from "lucide-react";

const CURRENCIES = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "OMR", label: "OMR — Omani Rial" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "QAR", label: "QAR — Qatari Riyal" },
  { value: "KWD", label: "KWD — Kuwaiti Dinar" },
  { value: "BHD", label: "BHD — Bahraini Dinar" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "INR", label: "INR — Indian Rupee" },
];

export function PaymentSettingsForm({ profile }: { profile: any }) {
  const [preference, setPreference] = useState<
    "always_upfront" | "project_basis"
  >(profile?.payment_preference || "project_basis");
  const [currency, setCurrency] = useState(profile?.default_currency || "USD");
  const [amount, setAmount] = useState(
    profile?.default_amount?.toString() || "",
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const stripeConnected = profile?.stripe_connected ?? false;

  async function handleSave() {
    if (
      preference === "always_upfront" &&
      (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
    ) {
      setErrorMsg("Please enter a valid default amount greater than 0");
      setStatus("error");
      return;
    }
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_preference: preference,
          default_currency: currency,
          default_amount:
            preference === "always_upfront" ? parseFloat(amount) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setStatus("saved");
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to save");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <CreditCard className="size-4 text-blue-600" />
          </div>
          <div>
            <CardTitle>Payment settings</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure how you charge clients for reports.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stripe status */}
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
            stripeConnected
              ? "bg-emerald-50 border-emerald-200"
              : "bg-muted/30 border-border"
          }`}
        >
          <div className="flex items-center gap-3">
            <Zap
              className={`size-4 ${stripeConnected ? "text-emerald-600" : "text-muted-foreground"}`}
            />
            <div>
              <p
                className={`text-xs font-medium ${stripeConnected ? "text-emerald-800" : "text-foreground"}`}
              >
                Stripe {stripeConnected ? "connected" : "not connected"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stripeConnected
                  ? "Clients can pay online via card."
                  : "Connect Stripe to accept online card payments."}
              </p>
            </div>
          </div>
          {!stripeConnected ? (
            <a
              href="https://dashboard.stripe.com/oauth/authorize"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-700 font-medium px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors flex-shrink-0"
            >
              Connect Stripe <ExternalLink className="size-3" />
            </a>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="size-3.5" /> Active
            </span>
          )}
        </div>

        <Separator />

        {/* Billing strategy */}
        <div>
          <p className="text-xs font-medium text-foreground/80 mb-2">
            Billing strategy
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                value: "always_upfront" as const,
                label: "Always upfront",
                desc: "Same default price for every project. Override per project at publish time.",
              },
              {
                value: "project_basis" as const,
                label: "Per project",
                desc: "Set the price individually when publishing each report.",
              },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setPreference(opt.value);
                  setStatus("idle");
                }}
                className={`text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
                  preference === opt.value
                    ? "border-brand-600 bg-brand-50"
                    : "border-border hover:border-border/60"
                }`}
              >
                <p
                  className={`text-xs font-semibold ${preference === opt.value ? "text-brand-800" : "text-foreground"}`}
                >
                  {opt.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Default amount (always_upfront only) */}
        {preference === "always_upfront" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Currency" htmlFor="pay_currency">
                <Select
                  id="pay_currency"
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    setStatus("idle");
                  }}
                  options={CURRENCIES}
                />
              </Field>
              <Field label="Default amount" htmlFor="pay_amount">
                <Input
                  id="pay_amount"
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setStatus("idle");
                  }}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </Field>
            </div>
            <InlineAlert tone="info" icon={<Info />}>
              This amount pre-fills the payment gate when you publish a report.
              You can always override it per project.
            </InlineAlert>
          </div>
        )}

        {preference === "project_basis" && (
          <InlineAlert tone="info" icon={<Info />}>
            When publishing a report you'll be prompted to set the price for
            that specific project — or choose to give free access.
          </InlineAlert>
        )}

        <Separator />

        {/* Status + save */}
        <div className="flex items-center justify-between">
          <div>
            {status === "saved" && (
              <InlineAlert tone="success" icon={<CheckCircle2 />}>
                Payment settings saved
              </InlineAlert>
            )}
            {status === "error" && (
              <InlineAlert tone="error" icon={<AlertCircle />}>
                {errorMsg}
              </InlineAlert>
            )}
          </div>
          <Button onClick={handleSave} loading={saving}>
            <Save className="size-4" /> Save settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
