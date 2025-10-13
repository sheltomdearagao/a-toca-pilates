import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

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
        'status-active': "border-transparent bg-status-active/20 text-status-active",
        'status-inactive': "border-transparent bg-status-inactive/20 text-status-inactive",
        'status-experimental': "border-transparent bg-status-experimental/20 text-status-experimental",
        'status-blocked': "border-transparent bg-status-blocked/20 text-status-blocked",
        'attendance-scheduled': "border-transparent bg-attendance-scheduled/20 text-attendance-scheduled",
        'attendance-present': "border-transparent bg-attendance-present/20 text-attendance-present",
        'attendance-absent': "border-transparent bg-attendance-absent/20 text-attendance-absent",
        'payment-pending': "border-transparent bg-payment-pending/20 text-payment-pending",
        'payment-paid': "border-transparent bg-payment-paid/20 text-payment-paid",
        'payment-overdue': "border-transparent bg-payment-overdue/20 text-payment-overdue",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }