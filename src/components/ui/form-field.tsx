"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

/* ── Label ─────────────────────────────────────────────────────────── */
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
    required?: boolean;
  }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "block text-xs font-medium text-foreground/80 mb-1 leading-none",
      className,
    )}
    {...props}
  >
    {children}
    {required && (
      <span className="text-destructive ml-0.5" aria-hidden>
        *
      </span>
    )}
  </LabelPrimitive.Root>
));
Label.displayName = "Label";

/* ── Field wrapper ─────────────────────────────────────────────────── */
interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

function Field({
  label,
  error,
  required,
  hint,
  helperText,
  children,
  className,
  htmlFor,
}: FieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {(hint || helperText) && (
        <p className="text-[11px] text-muted-foreground -mt-0.5">
          {hint ?? helperText}
        </p>
      )}
      {children}
      {error && <p className="text-[11px] text-destructive mt-0.5">{error}</p>}
    </div>
  );
}

export { Label, Field };
