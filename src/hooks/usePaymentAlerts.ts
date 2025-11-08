import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialTransaction } from '@/types/financial';
import { addDays, format } from 'date-fns';

const DAYS_THRESHOLD = 10; // Alerta para pagamentos nos próximos 10 dias

const fetchUpcomingPayments = async (): Promise<FinancialTransaction[]> => {
  console.log('🔍 Buscando pagamentos a vencer...');
  
  const today = new Date();
  const tenDaysFromNow = addDays(today, DAYS_THRESHOLD);

  const start = format(today, 'yyyy-MM-dd');
  const end = format(tenDaysFromNow, 'yyyy-MM-dd');

  console.log('📅 Período:', { start, end });

  // Busca transações de receita pendentes com vencimento entre hoje e +10 dias (inclusive)
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('*, students(id, name, phone, plan_type, plan_frequency, monthly_fee)')
    .eq('type', 'revenue')
    .eq('status', 'Pendente')
    .gte('due_date', start)
    .lte('due_date', end)
    .order('due_date', { ascending: true });

  console.log('📊 Resultado bruto:', { data, error });

  if (error) {
    console.error('❌ Erro na consulta de pagamentos:', error);
    throw new Error(error.message);
  }

  console.log('✅ Pagamentos encontrados:', data?.length || 0);
  
  // Retorna diretamente (server-side já filtrou corretamente)
  return (data || []) as unknown as FinancialTransaction[];
};

export const usePaymentAlerts = () => {
  const result = useQuery<FinancialTransaction[]>({
    queryKey: ['upcomingPayments'],
    queryFn: fetchUpcomingPayments,
    staleTime: 1000 * 60 * 2, // manter curto para refletir mudanças
    refetchOnWindowFocus: true,
  });

  console.log('🔄 Estado da query de pagamentos:', {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    dataLength: result.data?.length
  });

  return result;
};