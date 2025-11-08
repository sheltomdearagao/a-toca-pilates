import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CalendarClock, Loader2 } from 'lucide-react';
import { usePaymentAlerts } from '@/hooks/usePaymentAlerts';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const PaymentDueAlert = () => {
  const { data: upcomingPayments, isLoading } = usePaymentAlerts();

  console.log('🚨 PaymentDueAlert - Estado:', {
    upcomingPayments,
    isLoading,
    dataLength: upcomingPayments?.length
  });

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
  }

  if (!upcomingPayments || upcomingPayments.length === 0) {
    console.log('🚨 PaymentDueAlert - Nenhum pagamento encontrado');
    return null;
  }

  const count = upcomingPayments.length;
  const title = count === 1 
    ? `1 Pagamento Vence Hoje ou em Breve!` 
    : `${count} Pagamentos Vencem nos Próximos Dias!`;

  console.log('🚨 PaymentDueAlert - Mostrando alerta com', count, 'pagamentos');

  return (
    <Alert 
      variant="default" 
      className={cn(
        "bg-yellow-50/50 border-yellow-300 text-yellow-800 shadow-impressionist",
        "hover:shadow-lg transition-all duration-200"
      )}
    >
      <CalendarClock className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="font-bold">{title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-1">
        {upcomingPayments.slice(0, 3).map(t => (
          <p key={t.id} className="text-sm">
            <span className="font-semibold">{t.students?.name || 'Aluno Desconhecido'}</span>: {t.description} (Vence em {t.due_date ? format(parseISO(t.due_date), 'dd/MM') : 'N/A'})
          </p>
        ))}
        {count > 3 && (
          <p className="text-sm font-medium mt-1">
            ...e mais {count - 3} pagamentos.
          </p>
        )}
        <div className="mt-4">
          <Button asChild size="sm" variant="outline" className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-400">
            <Link to="/financeiro">
              Ver Todos os Lançamentos
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default PaymentDueAlert;