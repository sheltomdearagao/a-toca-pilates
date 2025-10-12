import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // New variants for student status
        "status-active": "border-transparent bg-status-active text-white",
        "status-inactive": "border-transparent bg-status-inactive text-white",
        "status-experimental": "border-transparent bg-status-experimental text-white",
        "status-blocked": "border-transparent bg-status-blocked text-white",
        // New variants for attendance status
        "attendance-scheduled": "border-transparent bg-attendance-scheduled text-white",
        "attendance-present": "border-transparent bg-attendance-present text-white",
        "attendance-absent": "border-transparent bg-attendance-absent text-white",
        // New variants for payment status
        "payment-pending": "border-transparent bg-payment-pending text-white",
        "payment-paid": "border-transparent bg-payment-paid text-white",
        "payment-overdue": "border-transparent bg-payment-overdue text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };