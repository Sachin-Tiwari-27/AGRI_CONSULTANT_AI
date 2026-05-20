"use client";

import { useState } from "react";
import { BarChart2, TrendingUp, PieChart, Activity, Check } from "lucide-react";
import type { ChartType, ChartDataPoint } from "./ChartNode";

interface Props {
  onInsert: (
    type: ChartType,
    title: string,
    data: ChartDataPoint[],
    currency: string,
  ) => void;
  onClose: () => void;
}

const CHART_TYPES: {
  type: ChartType;
  icon: React.ElementType;
  label: string;
}[] = [
  { type: "bar", icon: BarChart2, label: "Bar" },
  { type: "line", icon: TrendingUp, label: "Line" },
  { type: "area", icon: Activity, label: "Area" },
  { type: "pie", icon: PieChart, label: "Pie" },
];

const PRESETS = [
  {
    label: "Crop revenue",
    type: "bar" as ChartType,
    currency: "OMR",
    data: [
      { label: "Tomatoes", value: 45000 },
      { label: "Peppers", value: 28000 },
      { label: "Cucumbers", value: 18000 },
    ],
  },
  {
    label: "Monthly temperature",
    type: "line" as ChartType,
    currency: "",
    data: [
      { label: "Jan", value: 22 },
      { label: "Feb", value: 24 },
      { label: "Mar", value: 28 },
      { label: "Apr", value: 34 },
      { label: "May", value: 40 },
      { label: "Jun", value: 44 },
      { label: "Jul", value: 46 },
      { label: "Aug", value: 46 },
      { label: "Sep", value: 42 },
      { label: "Oct", value: 36 },
      { label: "Nov", value: 28 },
      { label: "Dec", value: 23 },
    ],
  },
  {
    label: "Investment breakdown",
    type: "pie" as ChartType,
    currency: "OMR",
    data: [
      { label: "CAPEX", value: 350000 },
      { label: "Pre-startup", value: 50000 },
      { label: "Working cap", value: 30000 },
    ],
  },
  {
    label: "Revenue growth",
    type: "area" as ChartType,
    currency: "OMR",
    data: [
      { label: "Y1", value: 85000 },
      { label: "Y2", value: 120000 },
      { label: "Y3", value: 145000 },
      { label: "Y4", value: 165000 },
      { label: "Y5", value: 180000 },
    ],
  },
];

export function ChartInsertPopover({ onInsert, onClose }: Props) {
  const [selectedType, setSelectedType] = useState<ChartType>("bar");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("");
  const [rawData, setRawData] = useState(
    '[{"label":"Item 1","value":100},\n {"label":"Item 2","value":150}]',
  );
  const [parseError, setParseError] = useState("");
  const [activePreset, setActivePreset] = useState<number | null>(null);

  function applyPreset(i: number) {
    const p = PRESETS[i];
    setSelectedType(p.type);
    setTitle(p.label);
    setCurrency(p.currency);
    setRawData(JSON.stringify(p.data, null, 2));
    setActivePreset(i);
    setParseError("");
  }

  function handleInsert() {
    try {
      const parsed: ChartDataPoint[] = JSON.parse(rawData);
      if (!Array.isArray(parsed)) throw new Error("Must be an array");
      onInsert(selectedType, title || "Chart", parsed, currency);
      onClose();
    } catch (e: any) {
      setParseError(e.message || "Invalid JSON data");
    }
  }

  return (
    <div className="w-[360px] rounded-xl border border-border bg-card shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <p className="text-xs font-semibold text-foreground">Insert chart</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Choose a type or start from a preset
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Chart type selector */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
            Chart type
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {CHART_TYPES.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  setActivePreset(null);
                }}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-medium transition-colors ${
                  selectedType === type
                    ? "bg-brand-800 text-white border-brand-800"
                    : "bg-card border-border text-muted-foreground hover:border-brand-400 hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
            Presets
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => applyPreset(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] text-left transition-colors ${
                  activePreset === i
                    ? "bg-brand-50 border-brand-300 text-brand-800"
                    : "bg-card border-border text-muted-foreground hover:border-brand-300 hover:text-foreground"
                }`}
              >
                {activePreset === i && (
                  <Check className="size-3 flex-shrink-0" />
                )}
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title + currency */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chart title"
              className="w-full h-8 px-2.5 text-xs rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">
              Currency (opt.)
            </label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="e.g. OMR"
              className="w-full h-8 px-2.5 text-xs rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Data editor */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground block mb-1">
            Data (JSON — array of {"{ label, value }"})
          </label>
          <textarea
            rows={5}
            value={rawData}
            onChange={(e) => {
              setRawData(e.target.value);
              setParseError("");
            }}
            className="w-full px-2.5 py-2 text-xs font-mono rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          {parseError && (
            <p className="text-[11px] text-destructive mt-1">{parseError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleInsert}
            className="flex-1 py-2 text-xs font-semibold rounded-lg bg-brand-800 text-white hover:bg-brand-700 transition-colors"
          >
            Insert chart
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
