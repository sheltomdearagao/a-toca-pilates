import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialTransaction } from '@/types/financial';
import { addDays, format, parseISO, isBefore, isAfter } from 'date-fns';

const DAYS_THRESHOLD = 10;

const fetchUpcomingPayments = async (): Promise<FinancialTransaction[]> => {
  console.log('🔍 [PAYMENT ALERTS] Iniciando busca...');
  
  const today = new Date();
  const tenDaysFromNow = addDays(today, DAYS_THRESHOLD);

  console.log('📅 [PAYMENT ALERTS] Período:', { 
    today: format(today, 'yyyy-MM-dd'),
    tenDaysFromNow: format(tenDaysFromNow, 'yyyy-MM-dd')
  });

  // Primeiro, busca TODAS as transações pendentes de receita
  const { data: allTransactions, error: transError } = await supabase
    .from('financial_transactions')
    .select('*')
    .eq('type', 'revenue')
    .eq('status', 'Pendente')
    .not('due_date', 'is', null);

  console.log('📊 [PAYMENT ALERTS] Transações pendentes encontradas:', allTransactions?.length || 0);

  if (transError) {
    console.error('❌ [PAYMENT ALERTS] Erro ao buscar transações:', transError);
    throw new Error(transError.message);
  }

  // Filtra no cliente as transações que vencem nos próximos 10 dias
  const filtered = (allTransactions || []).filter(t => {
    if (!t.due_date) return false;
    const dueDate = parseISO(t.due_date);
    const isInRange = !isBefore(dueDate, today) && !isAfter(dueDate, tenDaysFromNow);
    
    if (isInRange) {
      console.log('✅ [PAYMENT ALERTS] Transação incluída:', {
        description: t.description,
        due_date: t.due_date,
        student_id: t.student_id
      });
    }
    
    return isInRange;
  });

  console.log('📊 [PAYMENT ALERTS] Transações filtradas:', filtered.length);

  // Agora busca os dados dos alunos separadamente
  const studentIds = filtered.map(t => t.student_id).filter(Boolean) as string[];
  
  if (studentIds.length === 0) {
    console.log('⚠️ [PAYMENT ALERTS] Nenhum student_id encontrado');
    return filtered as FinancialTransaction[];
  }

  const { data: studentsData, error: studentsError } = await supabase
    .from('students')
    .select('id, name, phone, plan_type, plan_frequency, monthly_fee')
    .in('id', studentIds);

  console.log('📊 [PAYMENT ALERTS] Alunos encontrados:', studentsData?.length || 0);

  if (studentsError) {
    console.error('❌ [PAYMENT ALERTS] Erro ao buscar alunos:', studentsError);
  }

  // Combina os dados manualmente
  const result = filtered.map(t => ({
    ...t,
    students: studentsData?.find(s => s.id === t.student_id) || null
  })) as unknown as FinancialTransaction[];

  console.log('✅ [PAYMENT ALERTS] Resultado final:', result.length);

  return result;
};

export const usePaymentAlerts = () => {
  const result = useQuery<FinancialTransaction[]>({
    queryKey: ['upcomingPayments'],
    queryFn: fetchUpcomingPayments,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });

  console.log('🔄 [PAYMENT ALERTS] Estado da query:', {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    dataLength: result.data?.length
  });

  return result;
};