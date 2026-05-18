"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    company_name: "",
    role: "consultant",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          company_name: form.company_name,
          role: form.role,
        },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <>
      <h2 className="text-base font-semibold text-foreground mb-0.5">
        Create your account
      </h2>
      <p className="text-xs text-muted-foreground mb-6">
        Start your first AgriAI project today
      </p>

      <form onSubmit={handleRegister} className="space-y-4">
        <Field label="Full name" required htmlFor="full_name">
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            placeholder="Your full name"
            required
          />
        </Field>

        <Field label="Email" required htmlFor="email">
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </Field>

        <Field label="Company / Organisation" htmlFor="company_name">
          <Input
            id="company_name"
            value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)}
            placeholder="Your company"
          />
        </Field>

        <Field label="I am a" required htmlFor="role">
          <Select
            id="role"
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            options={[
              { value: "consultant", label: "Consultant / Expert" },
              { value: "client", label: "Farmer / Investor" },
            ]}
          />
        </Field>

        <Field label="Password" required htmlFor="password">
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder="Min 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>

        {error && (
          <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-5">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-brand-700 font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
