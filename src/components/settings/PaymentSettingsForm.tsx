"use client";
import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/FormFields";
import { Button } from "@/components/ui/Button";
import {
  Save,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Info,
  ExternalLink,
  Zap,
} from "lucide-react";

interface Props {
  profile: any;
}

const CURRENCY_OPTIONS = [
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

export function PaymentSettingsForm({ profile }: Props) {
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
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <CreditCard className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Payment settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure how you charge clients for reports.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* Stripe status */}
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
            stripeConnected
              ? "bg-emerald-50 border-emerald-200"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <Zap
              className={`w-4 h-4 ${stripeConnected ? "text-emerald-600" : "text-slate-400"}`}
            />
            <div>
              <p
                className={`text-sm font-medium ${stripeConnected ? "text-emerald-800" : "text-slate-700"}`}
              >
                Stripe {stripeConnected ? "connected" : "not connected"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {stripeConnected
                  ? "Clients can pay online via card. Payouts go to your connected account."
                  : "Connect Stripe to accept online card payments from clients."}
              </p>
            </div>
          </div>
          {!stripeConnected && (
            <a
              href="https://dashboard.stripe.com/oauth/authorize"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-700 font-medium px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors flex-shrink-0"
            >
              Connect Stripe <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {stripeConnected && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Active
            </span>
          )}
        </div>

        {/* Billing strategy */}
        <Field
          label="Billing strategy"
          helperText="Controls when and how the price gate is shown."
        >
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[
              {
                value: "always_upfront" as const,
                label: "Always upfront",
                desc: "Same default price for every project. You can still override per project.",
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
                    ? "border-green-600 bg-green-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${preference === opt.value ? "text-green-800" : "text-slate-700"}`}
                >
                  {opt.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
        </Field>

        {/* Always upfront: amount input */}
        {preference === "always_upfront" && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-600">
              Default charge amount
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Currency">
                <Select
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    setStatus("idle");
                  }}
                  options={CURRENCY_OPTIONS}
                />
              </Field>
              <Field label="Amount">
                <Input
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
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
              <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                This amount will pre-fill the payment gate when you publish a
                report. You can always change it per project at publish time.
              </p>
            </div>
          </div>
        )}

        {/* Per project explanation */}
        {preference === "project_basis" && (
          <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              When you publish a report, a popup will ask you to set the price
              for that specific project — or choose to give free access. The
              amount you enter there is saved to the project and shown to the
              client on their report page.
            </p>
          </div>
        )}

        {/* Status + save */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            {status === "saved" && (
              <p className="flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" /> Payment settings saved
              </p>
            )}
            {status === "error" && (
              <p className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" /> {errorMsg}
              </p>
            )}
          </div>
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4" /> Save settings
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
