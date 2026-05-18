import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
    "text-[11px] font-medium transition-colors whitespace-nowrap",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
  ],
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand-800 text-white",
        secondary: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border text-foreground bg-transparent",
        // Status variants — used across the platform
        green: "border-emerald-200 bg-emerald-50 text-emerald-700",
        amber: "border-amber-200 bg-amber-50 text-amber-700",
        red: "border-red-200 bg-red-50 text-red-700",
        blue: "border-blue-200 bg-blue-50 text-blue-700",
        purple: "border-purple-200 bg-purple-50 text-purple-700",
        violet: "border-violet-200 bg-violet-50 text-violet-700",
        gray: "border-slate-200 bg-slate-100 text-slate-600",
        orange: "border-orange-200 bg-orange-50 text-orange-700",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
