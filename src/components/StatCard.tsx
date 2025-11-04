"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  isLoading: boolean;
  variant?: "default" | "gradient" | "gradient-accent" | "gradient-destructive" | "bordered" | "bordered-green" | "bordered-red" | "bordered-yellow";
}

const StatCard = React.memo(({ title, value, description, icon, isLoading, variant = "default" }: StatCardProps) => {
  // Novo: borda esquerda colorida com base no variant
  let borderLeftClass = "";
  switch (variant) {
    case "bordered-green":
      borderLeftClass = "border-l-4 border-green-500";
      break;
    case "bordered-red":
      borderLeftClass = "border-l-4 border-red-500";
      break;
    case "bordered-yellow":
      borderLeftClass = "border-l-4 border-yellow-500";
      break;
    default:
      borderLeftClass = "";
  }

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-impressionist",
        borderLeftClass,
        (variant === "default" || variant.startsWith("bordered")) && "shadow-subtle-glow"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn(
          "text-sm font-medium",
          variant === "gradient" || variant === "gradient-accent" || variant === "gradient-destructive"
            ? "text-white/90"
            : "text-muted-foreground"
        )}>
          {title}
        </CardTitle>
        <div className={cn(
          "p-2 rounded-lg",
          variant === "gradient" || variant === "gradient-accent" || variant === "gradient-destructive"
            ? "bg-white/20"
            : "bg-primary/10"
        )}>
          {React.cloneElement(icon as React.ReactElement, {
            className: cn(
              "h-5 w-5",
              variant === "gradient" || variant === "gradient-accent" || variant === "gradient-destructive"
                ? "text-white"
                : "text-primary"
            )
          })}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-24 mb-2" />
            {description && <Skeleton className="h-4 w-32" />}
          </>
        ) : (
          <>
            <div className={cn(
              "text-2xl font-bold",
              variant === "gradient" || variant === "gradient-accent" || variant === "gradient-destructive"
                ? "text-white"
                : "text-foreground"
            )}>
              {value}
            </div>
            {description && (
              <p className={cn(
                "text-xs",
                variant === "gradient" || variant === "gradient-accent" || variant === "gradient-destructive"
                  ? "text-white/70"
                  : "text-muted-foreground"
              )}>
                {description}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
});

export default StatCard;