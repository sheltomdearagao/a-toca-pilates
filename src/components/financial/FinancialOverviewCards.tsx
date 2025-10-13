import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils"; // Importar cn

interface FinancialStats {
  monthlyRevenue: number;
  monthlyExpense: number;
  totalOverdue: number;
}

interface FinancialOverviewCardsProps {
  stats: FinancialStats | undefined;
  isLoading: boolean;
  formatCurrency: (value: number) => string;
}

const FinancialOverviewCards = ({ stats, isLoading, formatCurrency }: FinancialOverviewCardsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-3 mb-6">
      <Card className={cn("shadow-impressionist border-l-4", stats?.monthlyRevenue ? "border-primary" : "border-muted", "shadow-subtle-glow")}> {/* Aplicando a nova sombra e borda colorida */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{formatCurrency(stats?.monthlyRevenue ?? 0)}</div>}
        </CardContent>
      </Card>
      <Card className={cn("shadow-impressionist border-l-4", stats?.monthlyExpense ? "border-destructive" : "border-muted", "shadow-subtle-glow")}> {/* Aplicando a nova sombra e borda colorida */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Despesa do Mês</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{formatCurrency(stats?.monthlyExpense ?? 0)}</div>}
        </CardContent>
      </Card>
      <Card className={cn("shadow-impressionist border-l-4", stats?.totalOverdue ? "border-payment-overdue" : "border-muted", "shadow-subtle-glow")}> {/* Aplicando a nova sombra e borda colorida */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Inadimplência</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{formatCurrency(stats?.totalOverdue ?? 0)}</div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialOverviewCards;