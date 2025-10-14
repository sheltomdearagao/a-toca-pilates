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
  variant?: "default" | "gradient" | "gradient-accent" | "gradient-destructive" | "bordered" | "bordered-green" | "bordered-red" | "bordered-yellow"; // Adicionado novas variantes
}

const StatCard = ({ title, value, description, icon, isLoading, variant = "default" }: StatCardProps) => {
  return (
    <Card 
      variant={variant} // Usando a nova prop variant
      className={cn(
        "transition-all duration-200 hover:scale-[1.02] hover:shadow-lg", // Animação de hover mais sutil
        (variant === "default" || variant.startsWith("bordered")) && "shadow-subtle-glow" // Apply subtle glow to default and bordered variants
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
            <Skeleton className="h-4 w-32" />
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
};

export default StatCard;