import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialTransaction } from '@/types/financial';
import { addDays, format } from 'date-fns';

const DAYS_THRESHOLD = 10; // Alerta para pagamentos nos próximos 10 dias

const fetchUpcomingPayments = async (): Promise<FinancialTransaction[]> => {
  const today = new Date();
  const tenDaysFromNow = addDays(today, DAYS_THRESHOLD);

  const start = format(today, 'yyyy-MM-dd');
  const end = format(tenDaysFromNow, 'yyyy-MM-dd');

  // Busca transações de receita pendentes com vencimento entre hoje e +10 dias (inclusive)
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('*, students(id, name, phone, plan_type, plan_frequency, monthly_fee)')
    .eq('type', 'revenue')
    .eq('status', 'Pendente')
    .gte('due_date', start)
    .lte('due_date', end)
    .order('due_date', { ascending: true });

  if (error) throw new Error(error.message);

  // Retorna diretamente (server-side já filtrou corretamente)
  return (data || []) as unknown as FinancialTransaction[];
};

export const usePaymentAlerts = () => {
  return useQuery<FinancialTransaction[]>({
    queryKey: ['upcomingPayments'],
    queryFn: fetchUpcomingPayments,
    staleTime: 1000 * 60 * 2, // manter curto para refletir mudanças
    refetchOnWindowFocus: true,
  });
};