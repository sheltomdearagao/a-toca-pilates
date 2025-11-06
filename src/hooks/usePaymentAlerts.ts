import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialTransaction } from '@/types/financial';
import { addDays, isBefore, parseISO, format } from 'date-fns';

const DAYS_THRESHOLD = 10; // Alerta para pagamentos nos próximos 10 dias

const fetchUpcomingPayments = async (): Promise<FinancialTransaction[]> => {
  const today = new Date();
  const tenDaysFromNow = addDays(today, DAYS_THRESHOLD);

  // Busca transações de receita que estão Pendentes e têm data de vencimento no futuro próximo
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('*, students(id, name, phone, plan_type, plan_frequency, monthly_fee)') // Adicionando campos do plano
    .eq('type', 'revenue')
    .eq('status', 'Pendente')
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true });

  if (error) throw new Error(error.message);

  // Filtra no cliente para garantir que a data de vencimento esteja no intervalo [hoje, +10 dias]
  const upcomingPayments = (data || []).filter(t => {
    if (!t.due_date) return false;
    const dueDate = parseISO(t.due_date);
    
    // Deve ser hoje ou no futuro (até 10 dias)
    return isBefore(dueDate, tenDaysFromNow) && (isBefore(today, dueDate) || format(today, 'yyyy-MM-dd') === format(dueDate, 'yyyy-MM-dd'));
  });

  return upcomingPayments as FinancialTransaction[];
};

export const usePaymentAlerts = () => {
  return useQuery<FinancialTransaction[]>({
    queryKey: ['upcomingPayments'],
    queryFn: fetchUpcomingPayments,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });
};