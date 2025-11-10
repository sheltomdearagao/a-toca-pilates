import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialTransaction } from '@/types/financial';
import { addDays, format, parseISO, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';

const DAYS_THRESHOLD = 10;

const fetchUpcomingPayments = async (): Promise<FinancialTransaction[]> => {
  console.log('🔍 [PAYMENT ALERTS] Iniciando busca com novo sistema de validade...');
  
  const today = startOfDay(new Date());
  const tenDaysFromNow = endOfDay(addDays(today, DAYS_THRESHOLD));

  // Busca alunos com planos recorrentes que tenham validade vencendo em breve
  const { data: studentsWithExpiringValidity, error: studentsError } = await supabase
    .from('students')
    .select('id, name, phone, plan_type, plan_frequency, monthly_fee, validity_date')
    .eq('enrollment_type', 'Particular')
    .neq('plan_type', 'Avulso')
    .gte('validity_date', today.toISOString())
    .lte('validity_date', tenDaysFromNow.toISOString())
    .eq('status', 'Ativo');

  if (studentsError) {
    console.error('❌ [PAYMENT ALERTS] Erro ao buscar alunos:', studentsError);
    throw new Error(studentsError.message);
  }

  console.log('📊 [PAYMENT ALERTS] Alunos com validade vencendo:', studentsWithExpiringValidity?.length || 0);

  // Busca também transações pendentes tradicionais
  const { data: pendingTransactions, error: pendingError } = await supabase
    .from('financial_transactions')
    .select('*, students(name, phone, plan_type, plan_frequency)')
    .eq('type', 'revenue')
    .eq('status', 'Pendente')
    .gte('due_date', today.toISOString())
    .lte('due_date', tenDaysFromNow.toISOString());

  if (pendingError) {
    console.error('❌ [PAYMENT ALERTS] Erro ao buscar transações pendentes:', pendingError);
  }

  console.log('📊 [PAYMENT ALERTS] Transações pendentes encontradas:', pendingTransactions?.length || 0);

  // Combina os resultados
  const results: FinancialTransaction[] = [];

  // Adiciona alunos com validade vencendo como "transações" de alerta
  if (studentsWithExpiringValidity) {
    studentsWithExpiringValidity.forEach(student => {
      results.push({
        id: `validity-${student.id}`,
        user_id: '',
        student_id: student.id,
        description: `Mensalidade - ${student.plan_type} ${student.plan_frequency || ''} (Validade vencendo)`,
        category: 'Mensalidade',
        amount: student.monthly_fee || 0,
        type: 'revenue',
        status: 'Pendente',
        due_date: student.validity_date,
        paid_at: null,
        students: student,
        created_at: new Date().toISOString(),
      } as FinancialTransaction);
    });
  }

  // Adiciona transações pendentes tradicionais
  if (pendingTransactions) {
    results.push(...pendingTransactions);
  }

  console.log('✅ [PAYMENT ALERTS] Total de alertas:', results.length);
  return results;
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