import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/student';
import { startOfMonth, isBefore, parseISO, format } from 'date-fns';
import { showError, showSuccess } from '@/utils/toast';

const MAX_CREDITS = 0; // Alterado para 0, pois o ganho é por falta

// Função para buscar o aluno e aplicar a lógica de renovação
const fetchAndRenewCredits = async (studentId: string): Promise<Student> => {
  const { data: student, error } = await supabase
    .from('students')
    .select('id, name, reposition_credits, last_credit_renewal')
    .eq('id', studentId)
    .single();

  if (error) throw new Error(error.message);
  if (!student) throw new Error('Aluno não encontrado.');

  let currentCredits = student.reposition_credits ?? 0;
  const lastRenewal = student.last_credit_renewal ? parseISO(student.last_credit_renewal) : null;
  const today = new Date();
  const firstDayOfMonth = startOfMonth(today);

  // Lógica de Renovação: Se hoje é dia 1 ou depois, e a última renovação foi antes do início deste mês, zera os créditos.
  if (!lastRenewal || isBefore(lastRenewal, firstDayOfMonth)) {
    // Zera os créditos
    currentCredits = MAX_CREDITS;
    const renewalDate = format(today, 'yyyy-MM-dd');

    // Atualiza o banco de dados com a renovação
    const { error: updateError } = await supabase
      .from('students')
      .update({ 
        reposition_credits: MAX_CREDITS, 
        last_credit_renewal: renewalDate 
      })
      .eq('id', studentId);

    if (updateError) {
      console.error('Erro ao zerar créditos no DB:', updateError);
      // Não lançamos erro aqui para não quebrar a consulta, mas logamos.
    }
    
    return { ...student, reposition_credits: MAX_CREDITS, last_credit_renewal: renewalDate } as Student;
  }

  return student as Student;
};

export const useRepositionCredits = (studentId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: studentData, isLoading, error } = useQuery<Student>({
    queryKey: ['repositionCredits', studentId],
    queryFn: () => fetchAndRenewCredits(studentId!),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });

  const consumeCreditMutation = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error('ID do aluno não fornecido.');
      if ((studentData?.reposition_credits ?? 0) <= 0) throw new Error('Saldo de créditos insuficiente.');

      const newCredits = (studentData!.reposition_credits ?? 0) - 1;

      const { error } = await supabase
        .from('students')
        .update({ reposition_credits: newCredits })
        .eq('id', studentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositionCredits', studentId] });
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', studentId] });
      showSuccess('Crédito de reposição consumido com sucesso!');
    },
    onError: (err) => {
      showError(err.message);
    },
  });

  const adjustCreditMutation = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      if (!studentId) throw new Error('ID do aluno não fornecido.');

      const { error } = await supabase.rpc('adjust_reposition_credit_manual', {
        p_student_id: studentId,
        p_amount: amount,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['repositionCredits', studentId] });
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', studentId] });
      showSuccess(`Crédito ${variables.amount > 0 ? 'adicionado' : 'removido'} com sucesso!`);
    },
    onError: (err: any) => {
      showError(err.message);
    },
  });

  return {
    credits: studentData?.reposition_credits ?? 0,
    isLoading,
    error,
    consumeCredit: consumeCreditMutation,
    adjustCredit: adjustCreditMutation,
  };
};