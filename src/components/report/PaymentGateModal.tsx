"use client";
import { useState } from "react";
import {
  X,
  DollarSign,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
  projectTitle: string;
  clientEmail: string;
  currency: string;
  existingPrice: number | null;
  onConfirm: (
    price: number,
    currency: string,
    chargeClient: boolean,
  ) => Promise<void>;
  onClose: () => void;
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

export function PaymentGateModal({
  projectId,
  projectTitle,
  clientEmail,
  currency: defaultCurrency,
  existingPrice,
  onConfirm,
  onClose,
}: Props) {
  const [chargeClient, setChargeClient] = useState(true);
  const [price, setPrice] = useState(existingPrice?.toString() ?? "");
  const [currency, setCurrency] = useState(defaultCurrency || "USD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (
      chargeClient &&
      (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0)
    ) {
      setError("Please enter a valid price greater than 0");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(
        chargeClient ? parseFloat(price) : 0,
        currency,
        chargeClient,
      );
    } catch (e: any) {
      setError(e.message || "Failed to set price");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5 text-green-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Set report price before publishing
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                {projectTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Charge toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setChargeClient(true)}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${
                chargeClient
                  ? "border-green-600 bg-green-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Lock
                className={`w-5 h-5 ${chargeClient ? "text-green-700" : "text-slate-400"}`}
              />
              <div className="text-center">
                <p
                  className={`text-sm font-semibold ${chargeClient ? "text-green-800" : "text-slate-600"}`}
                >
                  Charge client
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Client pays to unlock full report
                </p>
              </div>
            </button>

            <button
              onClick={() => setChargeClient(false)}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${
                !chargeClient
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Unlock
                className={`w-5 h-5 ${!chargeClient ? "text-blue-600" : "text-slate-400"}`}
              />
              <div className="text-center">
                <p
                  className={`text-sm font-semibold ${!chargeClient ? "text-blue-800" : "text-slate-600"}`}
                >
                  Free access
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Client gets full report at no charge
                </p>
              </div>
            </button>
          </div>

          {/* Price input — only shown when charging */}
          {chargeClient && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">
                  Amount to charge
                </label>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="text-sm px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-slate-700 w-32"
                  >
                    {CURRENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="flex-1 text-sm px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  />
                </div>
              </div>

              {/* Stripe notice */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Payment collection requires Stripe to be connected. If Stripe
                  is not set up, the client will see the price but you'll need
                  to collect payment manually and then mark it as paid from the
                  report tab.
                </p>
              </div>
            </div>
          )}

          {/* Free access notice */}
          {!chargeClient && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                The full report will be immediately accessible to {clientEmail}{" "}
                at no charge. You can still collect payment offline and mark it
                as paid later.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <p className="text-xs text-slate-500">
            {chargeClient
              ? `Client at ${clientEmail} will be asked to pay before downloading`
              : `Client at ${clientEmail} gets immediate full access`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} loading={saving}>
              {chargeClient ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
              {chargeClient ? "Set price & publish" : "Publish free"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
