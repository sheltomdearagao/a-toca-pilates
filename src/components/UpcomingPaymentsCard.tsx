import { CalendarClock, DollarSign, Loader2, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, getDate } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { usePaymentAlerts } from "@/hooks/usePaymentAlerts";
import { formatCurrency } from "@/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const UpcomingPaymentsCard = () => {
  const { data: upcomingPayments, isLoading, error } = usePaymentAlerts();

  console.log('💳 UpcomingPaymentsCard - Estado:', {
    upcomingPayments,
    isLoading,
    error,
    dataLength: upcomingPayments?.length
  });

  const payments = upcomingPayments ?? [];

  return (
    <Card className="shadow-impressionist shadow-subtle-glow">
      <CardHeader className="flex items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center text-lg">
          <CalendarClock className="w-5 h-5 mr-2 text-yellow-600" />
          Pagamentos a Vencer
        </CardTitle>

        <div className="flex items-center text-sm text-muted-foreground">
          <DollarSign className="w-4 h-4 mr-1" />
          {isLoading ? <Skeleton className="h-4 w-8" /> : `${payments.length} pendência(s)`}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-1/2" />
          </div>
        ) : payments.length > 0 ? (
          <div className="space-y-3">
            {payments.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 rounded-xl border bg-yellow-50/20 transition-colors duration-200 hover:bg-yellow-50/40 hover:shadow-subtle-glow"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-600 rounded-lg">
                    <User className="w-4 h-4 text-white" />
                  </div>

                  <div>
                    <Link 
                      to={`/alunos/${t.students?.id}`} 
                      className="font-medium text-foreground hover:underline hover:text-primary"
                    >
                      {t.students?.name || t.description}
                    </Link>

                    <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {t.students?.plan_type} {t.students?.plan_frequency}
                      </Badge>
                      <span className="font-semibold text-yellow-800">
                        {t.due_date ? format(parseISO(t.due_date), "dd/MM", { locale: ptBR }) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-lg font-bold text-red-600">
                  {formatCurrency(t.amount)}
                </div>
              </div>
            ))}
            {payments.length > 5 && (
              <div className="text-center pt-2">
                <Link to="/financeiro" className="text-sm text-primary hover:underline">
                  Ver mais {payments.length - 5} pagamentos
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4 opacity-50">🎉</div>
            <p className="text-muted-foreground">Nenhum pagamento a vencer nos próximos 10 dias.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingPaymentsCard;