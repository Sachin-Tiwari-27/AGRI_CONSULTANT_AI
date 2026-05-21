"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getCurrencyByGPS } from "@/lib/utils";
import { Plus } from "lucide-react";

const schema = z.object({
  title: z.string().min(3, "Title is required"),
  client_name: z.string().min(2, "Client name is required"),
  client_email: z.string().email("Valid email required"),
  region: z.string().optional(),
  country: z.string().optional(),
  gps_coordinates: z.string().optional(),
  land_size_sqm: z.string().optional(),
  project_type: z.string().optional(),
  budget_range: z.string().optional(),
  currency: z.string().optional(),
  experience_level: z.string().optional(),
  consultant_notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const CROP_OPTIONS = [
  "Cherry Tomato",
  "Beef Tomato",
  "Capsicum",
  "Cucumber",
  "Lettuce",
  "Herbs",
  "Strawberry",
  "Microgreens",
  "Fig",
  "Chilli",
  "Eggplant",
  "Other",
];

interface Props {
  onClose: () => void;
}

export function CreateProjectModal({ onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [customCrop, setCustomCrop] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const watchedGPS = watch("gps_coordinates");
  useEffect(() => {
    if (watchedGPS) setValue("currency", getCurrencyByGPS(watchedGPS));
  }, [watchedGPS, setValue]);

  function toggleCrop(crop: string) {
    setSelectedCrops((prev) =>
      prev.includes(crop) ? prev.filter((c) => c !== crop) : [...prev, crop],
    );
  }

  function addCustomCrop() {
    const t = customCrop.trim();
    if (t && !selectedCrops.includes(t)) {
      setSelectedCrops((prev) => [...prev.filter((c) => c !== "Other"), t]);
      setCustomCrop("");
    }
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          land_size_sqm: data.land_size_sqm
            ? parseFloat(data.land_size_sqm)
            : undefined,
          crop_types: selectedCrops,
        }),
      });
      const project = await res.json();
      if (!res.ok) throw new Error(project.error);
      router.push(`/project/${project.id}`);
    } catch {
      alert("Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new consultancy project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 pb-6">
          {/* ── Client ─────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Client
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Project title"
                error={errors.title?.message}
                required
              >
                <Input
                  {...register("title")}
                  placeholder="Al Hamra Greenhouse Farm"
                />
              </Field>
              <Field
                label="Client name"
                error={errors.client_name?.message}
                required
              >
                <Input
                  {...register("client_name")}
                  placeholder="Ahmed Al Abri"
                />
              </Field>
              <Field
                label="Client email"
                error={errors.client_email?.message}
                required
                className="col-span-2"
              >
                <Input
                  {...register("client_email")}
                  type="email"
                  placeholder="client@example.com"
                />
              </Field>
            </div>
          </div>

          <Separator />

          {/* ── Site ───────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Site
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Region / City">
                <Input {...register("region")} placeholder="Al Hamra" />
              </Field>
              <Field label="Country">
                <Input {...register("country")} placeholder="Oman" />
              </Field>
              <Field
                label="GPS coordinates"
                hint="Paste from Google Maps — auto-detects currency"
              >
                <Input
                  {...register("gps_coordinates")}
                  placeholder="23.1234, 57.5678"
                />
              </Field>
              <Field label="Land size (sqm)">
                <Input
                  {...register("land_size_sqm")}
                  type="number"
                  placeholder="38486"
                />
              </Field>
            </div>
          </div>

          <Separator />

          {/* ── Project ────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Project
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Project type">
                <Select
                  {...register("project_type")}
                  placeholder="Select type"
                  options={[
                    {
                      value: "greenhouse_turnkey",
                      label: "Greenhouse Turnkey",
                    },
                    { value: "expansion", label: "Expansion" },
                    { value: "feasibility_only", label: "Feasibility Only" },
                    { value: "agro_tourism", label: "Agro-Tourism" },
                  ]}
                />
              </Field>
              <Field label="Client experience">
                <Select
                  {...register("experience_level")}
                  placeholder="Select experience"
                  options={[
                    { value: "first_time", label: "First-time grower" },
                    { value: "1_3_years", label: "1–3 years" },
                    { value: "3_6_years", label: "3–6 years" },
                    { value: "6_plus_years", label: "6+ years" },
                  ]}
                />
              </Field>
              <Field label="Budget range" className="col-span-2">
                <div className="flex gap-2">
                  <Select
                    {...register("currency")}
                    className="w-28"
                    options={[
                      { value: "OMR", label: "OMR" },
                      { value: "USD", label: "USD" },
                      { value: "AED", label: "AED" },
                      { value: "SAR", label: "SAR" },
                      { value: "QAR", label: "QAR" },
                      { value: "KWD", label: "KWD" },
                      { value: "BHD", label: "BHD" },
                    ]}
                  />
                  <Input
                    {...register("budget_range")}
                    placeholder="e.g. 500,000 – 800,000"
                    className="flex-1"
                  />
                </div>
              </Field>
            </div>
          </div>

          <Separator />

          {/* ── Crops ──────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Target crops
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CROP_OPTIONS.map((crop) => (
                <button
                  key={crop}
                  type="button"
                  onClick={() => toggleCrop(crop)}
                  className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-colors ${
                    selectedCrops.includes(crop)
                      ? "bg-brand-800 text-white border-brand-800"
                      : "bg-card text-muted-foreground border-border hover:border-brand-400 hover:text-foreground"
                  }`}
                >
                  {crop}
                </button>
              ))}
            </div>
            {selectedCrops.includes("Other") && (
              <div className="flex gap-2 mt-2.5">
                <Input
                  value={customCrop}
                  onChange={(e) => setCustomCrop(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addCustomCrop())
                  }
                  placeholder="Type custom crop name…"
                  className="flex-1"
                />
                <Button type="button" size="sm" onClick={addCustomCrop}>
                  Add
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Notes ──────────────────────────────────────────── */}
          <Field label="Call notes / brief">
            <Textarea
              {...register("consultant_notes")}
              placeholder="Key points from the intro conversation…"
              className="min-h-[72px]"
            />
          </Field>

          {/* ── Actions ────────────────────────────────────────── */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              <Plus className="size-4" /> Create project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
