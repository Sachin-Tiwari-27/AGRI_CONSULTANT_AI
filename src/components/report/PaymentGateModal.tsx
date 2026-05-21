"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { InlineAlert } from "@/components/ui/status";
import { Lock, Unlock, AlertCircle, CreditCard } from "lucide-react";

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
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center">
              <CreditCard className="size-4 text-brand-700" />
            </div>
            <div>
              <DialogTitle>Set report price</DialogTitle>
              <DialogDescription className="truncate max-w-xs">
                {projectTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Charge toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setChargeClient(true)}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${
                chargeClient
                  ? "border-brand-600 bg-brand-50"
                  : "border-border hover:border-border/60"
              }`}
            >
              <Lock
                className={`size-5 ${chargeClient ? "text-brand-700" : "text-muted-foreground"}`}
              />
              <div className="text-center">
                <p
                  className={`text-xs font-semibold ${chargeClient ? "text-brand-800" : "text-foreground"}`}
                >
                  Charge client
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  Client pays to unlock report
                </p>
              </div>
            </button>

            <button
              onClick={() => setChargeClient(false)}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${
                !chargeClient
                  ? "border-blue-500 bg-blue-50"
                  : "border-border hover:border-border/60"
              }`}
            >
              <Unlock
                className={`size-5 ${!chargeClient ? "text-blue-600" : "text-muted-foreground"}`}
              />
              <div className="text-center">
                <p
                  className={`text-xs font-semibold ${!chargeClient ? "text-blue-800" : "text-foreground"}`}
                >
                  Free access
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  Client gets full report free
                </p>
              </div>
            </button>
          </div>

          {/* Price input */}
          {chargeClient && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                  Amount to charge
                </label>
                <div className="flex gap-2">
                  <Select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    options={CURRENCIES}
                    className="w-36"
                  />
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="flex-1 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <InlineAlert tone="warning" icon={<AlertCircle />}>
                Stripe must be connected for online payments. Otherwise, collect
                payment manually and mark as paid from the Report tab.
              </InlineAlert>
            </div>
          )}

          {!chargeClient && (
            <InlineAlert tone="info" icon={<Unlock className="size-3.5" />}>
              The full report will be immediately accessible to{" "}
              <strong>{clientEmail}</strong> at no charge.
            </InlineAlert>
          )}

          {error && (
            <InlineAlert tone="error" icon={<AlertCircle />}>
              {error}
            </InlineAlert>
          )}
        </div>

        <DialogFooter>
          <p className="text-[11px] text-muted-foreground mr-auto">
            {chargeClient
              ? `${clientEmail} will be asked to pay before downloading`
              : `${clientEmail} gets immediate full access`}
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} loading={saving}>
            {chargeClient ? (
              <>
                <Lock className="size-3.5" /> Set price &amp; publish
              </>
            ) : (
              <>
                <Unlock className="size-3.5" /> Publish free
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
