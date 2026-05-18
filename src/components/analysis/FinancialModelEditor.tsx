"use client";
import { useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  TrendingUp,
  DollarSign,
  Clock,
  BarChart3,
  Leaf,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import type { FinancialModel, CropProjection } from "@/types";

interface Props {
  projectId: string;
  currency: string;
  initialModel: FinancialModel | null;
  initialNotes: string;
  source: "override" | "report_draft" | "none" | "ai_estimate";
  onSaved: (model: FinancialModel, notes: string) => void;
}

// ── Derived field recalculator (mirrors server logic) ─────────────────
function recalculate(model: FinancialModel): FinancialModel {
  const cropRevenue = model.crops.reduce(
    (s, c) => s + (Number(c.annual_revenue) || 0),
    0,
  );
  const totalRevenue = cropRevenue + (Number(model.agro_tourism_revenue) || 0);
  const opex =
    (Number(model.growing_cost_annual) || 0) +
    (Number(model.manpower_cost_annual) || 0);
  const ebitda = totalRevenue - opex;
  const ebitdaMargin =
    totalRevenue > 0 ? Math.round((ebitda / totalRevenue) * 100) : 0;
  const totalInvestment =
    (Number(model.capex_total) || 0) + (Number(model.pre_startup_cost) || 0);
  const paybackYears =
    ebitda > 0 ? Math.round((totalInvestment / ebitda) * 10) / 10 : 0;
  return {
    ...model,
    total_annual_revenue: totalRevenue,
    ebitda,
    ebitda_margin: ebitdaMargin,
    payback_years: paybackYears,
  };
}

// ── Crop row revenue auto-calc ────────────────────────────────────────
function calcCropRevenue(crop: CropProjection): number {
  const yieldKg = (Number(crop.yield_tonnes) || 0) * 1000;
  return Math.round(yieldKg * (Number(crop.price_per_kg) || 0));
}

// ── Number input cell ─────────────────────────────────────────────────
function NumCell({
  value,
  onChange,
  prefix = "",
  suffix = "",
  min = 0,
  step = 1,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  step?: number;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(String(value));

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {prefix && (
        <span className="text-xs text-slate-400 flex-shrink-0">{prefix}</span>
      )}
      <input
        type="number"
        value={focused ? raw : value}
        min={min}
        step={step}
        onFocus={() => {
          setFocused(true);
          setRaw(String(value));
        }}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => {
          setFocused(false);
          const n = parseFloat(raw);
          if (!isNaN(n) && n >= min) onChange(n);
          else setRaw(String(value));
        }}
        className="w-full text-sm text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-green-500 focus:outline-none py-0.5 px-1 transition-colors"
      />
      {suffix && (
        <span className="text-xs text-slate-400 flex-shrink-0">{suffix}</span>
      )}
    </div>
  );
}

// ── Read-only computed cell ───────────────────────────────────────────
function ComputedCell({
  value,
  currency,
  highlight = false,
}: {
  value: number;
  currency: string;
  highlight?: boolean;
}) {
  return (
    <span
      className={`text-sm font-medium tabular-nums ${highlight ? "text-emerald-700" : "text-slate-700"}`}
    >
      {formatCurrency(value, currency)}
    </span>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────
function Section({
  title,
  icon: Icon,
  iconClass,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  iconClass: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-semibold text-slate-900 flex-1">
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && <div className="bg-white">{children}</div>}
    </div>
  );
}

const DEFAULT_MODEL: FinancialModel = {
  capex_total: 0,
  pre_startup_cost: 0,
  crops: [],
  agro_tourism_revenue: 0,
  total_annual_revenue: 0,
  growing_cost_annual: 0,
  manpower_cost_annual: 0,
  ebitda: 0,
  ebitda_margin: 0,
  payback_years: 0,
  assumptions: [],
};

// ── Main component ────────────────────────────────────────────────────
export function FinancialModelEditor({
  projectId,
  currency,
  initialModel,
  initialNotes,
  source,
  onSaved,
}: Props) {
  const [model, setModel] = useState<FinancialModel>(
    initialModel ?? DEFAULT_MODEL,
  );
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newAssumption, setNewAssumption] = useState("");

  const derived = recalculate(model);

  function update(patch: Partial<FinancialModel>) {
    setModel((prev) => recalculate({ ...prev, ...patch }));
    setDirty(true);
  }

  function updateCrop(idx: number, patch: Partial<CropProjection>) {
    const crops = model.crops.map((c, i) => {
      if (i !== idx) return c;
      const updated = { ...c, ...patch };
      updated.annual_revenue = calcCropRevenue(updated);
      return updated;
    });
    update({ crops });
  }

  function addCrop() {
    const newCrop: CropProjection = {
      name: "New Crop",
      area_sqm: 1000,
      yield_tonnes: 0,
      price_per_kg: 0,
      annual_revenue: 0,
    };
    update({ crops: [...model.crops, newCrop] });
  }

  function removeCrop(idx: number) {
    update({ crops: model.crops.filter((_, i) => i !== idx) });
  }

  function addAssumption() {
    const t = newAssumption.trim();
    if (!t) return;
    update({ assumptions: [...(model.assumptions ?? []), t] });
    setNewAssumption("");
  }

  function removeAssumption(idx: number) {
    update({
      assumptions: (model.assumptions ?? []).filter((_, i) => i !== idx),
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/financial-model`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financialModel: derived, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setModel(data.financialModel);
      setDirty(false);
      onSaved(data.financialModel, notes);
      toast.success(
        "Financial model saved — report will use these figures on next generation",
      );
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Failed to save financial model",
      );
    } finally {
      setSaving(false);
    }
  }

  // KPI health signals
  const paybackGood = derived.payback_years > 0 && derived.payback_years <= 5;
  const marginGood = derived.ebitda_margin >= 25;
  const revenuePositive = derived.total_annual_revenue > 0;

  return (
    <div className="space-y-4">
      {/* Source banner */}
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm border ${
          source === "override" || source === "ai_estimate"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : source === "report_draft"
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
        }`}
      >
        {source === "override" ? (
          <>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Showing your
            saved override — this model will be used in the next report
            generation.
          </>
        ) : source === "ai_estimate" ? (
          <>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Showing your
            saved AI estimate — review and save edits to refine the figures
            before report generation.
          </>
        ) : source === "report_draft" ? (
          <>
            <Info className="w-4 h-4 flex-shrink-0" /> Showing AI-generated
            model from report draft. Edit and save to lock in your own figures.
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> No financial model
            yet. Generate a report first or enter figures manually below.
          </>
        )}
      </div>

      {/* Live KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Total Investment",
            value: derived.capex_total + derived.pre_startup_cost,
            icon: DollarSign,
            sub: `CAPEX + Pre-startup`,
            good: null,
            iconBg: "bg-blue-50",
            iconColor: "text-blue-600",
          },
          {
            label: "Annual Revenue",
            value: derived.total_annual_revenue,
            icon: TrendingUp,
            sub: `${model.crops.length} crop stream${model.crops.length !== 1 ? "s" : ""}`,
            good: revenuePositive,
            iconBg: "bg-emerald-50",
            iconColor: "text-emerald-600",
          },
          {
            label: "EBITDA",
            value: derived.ebitda,
            icon: BarChart3,
            sub: `${derived.ebitda_margin}% margin`,
            good: marginGood,
            iconBg: "bg-violet-50",
            iconColor: "text-violet-600",
          },
          {
            label: "Payback Period",
            value: null,
            icon: Clock,
            sub:
              derived.payback_years > 0
                ? `${derived.payback_years} years`
                : "N/A",
            good: paybackGood,
            iconBg: "bg-amber-50",
            iconColor: "text-amber-600",
          },
        ].map(({ label, value, icon: Icon, sub, good, iconBg, iconColor }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3"
          >
            <div className={`p-2.5 rounded-xl ${iconBg} flex-shrink-0`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className="text-base font-bold text-slate-900 mt-0.5 leading-tight tabular-nums">
                {value !== null ? formatCurrency(value, currency) : sub}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {good === true && (
                  <ArrowUpRight className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                )}
                {good === false && (
                  <ArrowDownRight className="w-3 h-3 text-red-400 flex-shrink-0" />
                )}
                {value !== null && (
                  <p className="text-[11px] text-slate-400 truncate">{sub}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Capital investment ────────────────────────────────────── */}
      <Section
        title="Capital Investment (CAPEX)"
        icon={DollarSign}
        iconClass="bg-blue-50 text-blue-600"
      >
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">
                Total CAPEX ({currency})
              </label>
              <NumCell
                value={model.capex_total}
                onChange={(v) => update({ capex_total: v })}
                prefix={currency}
                step={1000}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">
                Pre-startup Cost ({currency})
              </label>
              <NumCell
                value={model.pre_startup_cost}
                onChange={(v) => update({ pre_startup_cost: v })}
                prefix={currency}
                step={500}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-600">
              Total Investment
            </span>
            <ComputedCell
              value={derived.capex_total + derived.pre_startup_cost}
              currency={currency}
              highlight
            />
          </div>
        </div>
      </Section>

      {/* ── Crop projections ──────────────────────────────────────── */}
      <Section
        title="Crop Revenue Projections"
        icon={Leaf}
        iconClass="bg-green-50 text-green-600"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[
                  "Crop name",
                  `Area (sqm)`,
                  `Yield (t/yr)`,
                  `Price / kg (${currency})`,
                  `Annual revenue`,
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.crops.map((crop, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors group"
                >
                  {/* Name */}
                  <td className="px-4 py-2.5">
                    <input
                      value={crop.name}
                      onChange={(e) =>
                        updateCrop(idx, { name: e.target.value })
                      }
                      className="w-full text-sm text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-green-500 focus:outline-none py-0.5 px-1 transition-colors min-w-[120px]"
                    />
                  </td>
                  {/* Area */}
                  <td className="px-4 py-2.5">
                    <NumCell
                      value={crop.area_sqm}
                      onChange={(v) => updateCrop(idx, { area_sqm: v })}
                      step={100}
                    />
                  </td>
                  {/* Yield */}
                  <td className="px-4 py-2.5">
                    <NumCell
                      value={crop.yield_tonnes}
                      onChange={(v) => updateCrop(idx, { yield_tonnes: v })}
                      step={0.5}
                    />
                  </td>
                  {/* Price */}
                  <td className="px-4 py-2.5">
                    <NumCell
                      value={crop.price_per_kg}
                      onChange={(v) => updateCrop(idx, { price_per_kg: v })}
                      step={0.05}
                    />
                  </td>
                  {/* Revenue (computed) */}
                  <td className="px-4 py-2.5">
                    <ComputedCell
                      value={crop.annual_revenue}
                      currency={currency}
                      highlight
                    />
                  </td>
                  {/* Delete */}
                  <td className="px-2 py-2.5">
                    <button
                      onClick={() => removeCrop(idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Add crop row */}
              <tr className="border-b border-dashed border-slate-200">
                <td colSpan={6} className="px-4 py-2">
                  <button
                    onClick={addCrop}
                    className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 font-medium px-2 py-1 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add crop
                  </button>
                </td>
              </tr>

              {/* Totals row */}
              <tr className="bg-slate-50">
                <td
                  colSpan={4}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 text-right"
                >
                  Crop revenue subtotal
                </td>
                <td className="px-4 py-2.5">
                  <ComputedCell
                    value={model.crops.reduce(
                      (s, c) => s + (c.annual_revenue ?? 0),
                      0,
                    )}
                    currency={currency}
                    highlight
                  />
                </td>
                <td />
              </tr>
            </tbody>
          </table>

          {/* Agro-tourism */}
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-4">
            <label className="text-xs font-medium text-slate-600">
              Agro-tourism / ancillary revenue ({currency}/yr)
            </label>
            <div className="w-48">
              <NumCell
                value={model.agro_tourism_revenue ?? 0}
                onChange={(v) => update({ agro_tourism_revenue: v })}
                prefix={currency}
                step={500}
              />
            </div>
          </div>

          {/* Total revenue */}
          <div className="px-5 py-3 border-t-2 border-slate-200 flex items-center justify-between bg-emerald-50/40">
            <span className="text-sm font-bold text-slate-800">
              Total Annual Revenue
            </span>
            <ComputedCell
              value={derived.total_annual_revenue}
              currency={currency}
              highlight
            />
          </div>
        </div>
      </Section>

      {/* ── Operating costs ───────────────────────────────────────── */}
      <Section
        title="Annual Operating Costs"
        icon={Zap}
        iconClass="bg-orange-50 text-orange-600"
      >
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">
                Growing costs / yr ({currency})
              </label>
              <p className="text-[11px] text-slate-400 mb-1.5">
                Seeds, nutrients, substrates, packaging
              </p>
              <NumCell
                value={model.growing_cost_annual}
                onChange={(v) => update({ growing_cost_annual: v })}
                prefix={currency}
                step={1000}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">
                Manpower / yr ({currency})
              </label>
              <p className="text-[11px] text-slate-400 mb-1.5">
                Full-time + seasonal labour
              </p>
              <NumCell
                value={model.manpower_cost_annual}
                onChange={(v) => update({ manpower_cost_annual: v })}
                prefix={currency}
                step={1000}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-600">
              Total OPEX / yr
            </span>
            <ComputedCell
              value={derived.growing_cost_annual + derived.manpower_cost_annual}
              currency={currency}
            />
          </div>
        </div>
      </Section>

      {/* ── Summary ───────────────────────────────────────────────── */}
      <Section
        title="Profitability Summary"
        icon={BarChart3}
        iconClass="bg-violet-50 text-violet-600"
      >
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {[
              {
                label: "Total Annual Revenue",
                value: derived.total_annual_revenue,
                computed: true,
              },
              {
                label: "Total OPEX / yr",
                value:
                  derived.growing_cost_annual + derived.manpower_cost_annual,
                computed: true,
              },
              {
                label: "EBITDA / yr",
                value: derived.ebitda,
                computed: true,
                bold: true,
              },
              {
                label: "EBITDA Margin",
                value: null,
                display: `${derived.ebitda_margin}%`,
                computed: true,
                bold: true,
              },
              {
                label: "Total Investment",
                value: derived.capex_total + derived.pre_startup_cost,
                computed: true,
              },
              {
                label: "Payback Period",
                value: null,
                display:
                  derived.payback_years > 0
                    ? `${derived.payback_years} yrs`
                    : "N/A",
                computed: true,
                bold: true,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"
              >
                <span
                  className={`text-xs text-slate-500 ${row.bold ? "font-semibold text-slate-700" : ""}`}
                >
                  {row.label}
                </span>
                <span
                  className={`text-sm tabular-nums ${row.bold ? "font-bold text-slate-900" : "font-medium text-slate-700"} ${row.value !== null && row.value < 0 ? "text-red-600" : ""}`}
                >
                  {row.display ?? formatCurrency(row.value!, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Assumptions ───────────────────────────────────────────── */}
      <Section
        title="Assumptions & Notes"
        icon={Info}
        iconClass="bg-slate-100 text-slate-600"
        defaultOpen={false}
      >
        <div className="px-5 py-4 space-y-3">
          {(model.assumptions ?? []).length > 0 && (
            <ul className="space-y-1.5">
              {(model.assumptions ?? []).map((a, i) => (
                <li key={i} className="flex items-start gap-2 group">
                  <span className="text-slate-300 mt-0.5">·</span>
                  <span className="flex-1 text-xs text-slate-600">{a}</span>
                  <button
                    onClick={() => removeAssumption(i)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-300 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              value={newAssumption}
              onChange={(e) => setNewAssumption(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAssumption()}
              placeholder="Add an assumption or benchmark note…"
              className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            />
            <button
              onClick={addAssumption}
              className="text-xs text-green-700 font-medium px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-50 transition-colors"
            >
              Add
            </button>
          </div>

          {/* Consultant notes */}
          <div className="pt-3 border-t border-slate-100">
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Consultant notes (private, injected into report)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              placeholder="Any context, caveats, or market-specific adjustments for this model…"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none bg-white"
            />
          </div>
        </div>
      </Section>

      {/* Save bar */}
      <div
        className={`sticky bottom-0 flex items-center justify-between px-5 py-3.5 rounded-xl border transition-all ${
          dirty
            ? "bg-slate-900 border-slate-700 shadow-lg shadow-slate-900/20"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <p
          className={`text-xs font-medium ${dirty ? "text-slate-300" : "text-slate-400"}`}
        >
          {dirty
            ? "⬤ Unsaved changes — save to update the report on next generation"
            : source === "override"
              ? "✓ Model saved — report will use these figures"
              : "No unsaved changes"}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setModel(initialModel ?? DEFAULT_MODEL);
                setNotes(initialNotes);
                setDirty(false);
              }}
              className={
                dirty ? "text-slate-400 hover:text-white hover:bg-white/10" : ""
              }
            >
              Discard
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={!dirty}
            className={
              dirty
                ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white"
                : ""
            }
          >
            <Save className="w-3.5 h-3.5" />
            Save model
          </Button>
        </div>
      </div>
    </div>
  );
}
