import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { FinancialTransaction } from '@/types/financial';

interface CreateStudentTransactionParams {
  studentId: string;
  description: string;
  amount: number;
  dueDate?: string;
  category?: string;
  status?: 'Pago' | 'Pendente' | 'Atrasado';
}

interface UpdateStudentCreditParams {
  studentId: string;
  amount: number;
  reason: string;
  entryType: 'absence' | 'manual_adjustment' | 'payment_bonus';
}

export const useStudentFinancialIntegration = () => {
  const queryClient = useQueryClient();

  // Criar transação financeira para aluno
  const createStudentTransactionMutation = useMutation({
    mutationFn: async (params: CreateStudentTransactionParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const transaction = {
        user_id: user.id,
        student_id: params.studentId,
        description: params.description,
        category: params.category || 'Mensalidade',
        amount: params.amount,
        type: 'revenue' as const,
        status: params.status || 'Pendente',
        due_date: params.dueDate || null,
      };

      const { data, error } = await supabase
        .from('financial_transactions')
        .insert([transaction])
        .select()
        .single();

      if (error) throw error;
      return data as FinancialTransaction;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', data.student_id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      showSuccess('Transação financeira criada com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  // Atualizar créditos de reposição do aluno
  const updateStudentCreditMutation = useMutation({
    mutationFn: async (params: UpdateStudentCreditParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // Usa a função RPC para adicionar crédito
      const { error } = await supabase.rpc('add_reposition_credit', {
        p_student_id: params.studentId,
        p_amount: params.amount,
        p_reason: params.reason,
        p_entry_type: params.entryType,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['repositionCredits', variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', variables.studentId] });
      showSuccess('Créditos de reposição atualizados com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  // Marcar transação como paga e atualizar validade do aluno
  const markTransactionAsPaidMutation = useMutation({
    mutationFn: async ({ transactionId, studentId, validityDays }: {
      transactionId: string;
      studentId: string;
      validityDays?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // Atualiza a transação como paga
      const { error: transactionError } = await supabase
        .from('financial_transactions')
        .update({ 
          status: 'Pago',
          paid_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (transactionError) throw transactionError;

      // Se for mensalidade e tiver dias de validade, atualiza o aluno
      if (validityDays && validityDays > 0) {
        const validityDate = new Date();
        validityDate.setDate(validityDate.getDate() + validityDays);

        const { error: studentError } = await supabase
          .from('students')
          .update({ 
            validity_date: validityDate.toISOString(),
            status: 'Ativo'
          })
          .eq('id', studentId);

        if (studentError) throw studentError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      showSuccess('Transação marcada como paga com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  // Criar transação de mensalidade com validade
  const createMonthlyTransactionMutation = useMutation({
    mutationFn: async ({ studentId, amount, planType, frequency, validityDays }: {
      studentId: string;
      amount: number;
      planType: string;
      frequency?: string;
      validityDays: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const dueDate = new Date();
      const validityDate = new Date();
      validityDate.setDate(validityDate.getDate() + validityDays);

      const transaction = {
        user_id: user.id,
        student_id: studentId,
        description: `Mensalidade - ${planType} ${frequency || ''}`,
        category: 'Mensalidade',
        amount: amount,
        type: 'revenue' as const,
        status: 'Pendente' as const,
        due_date: dueDate.toISOString(),
      };

      // Cria a transação
      const { data: transactionData, error: transactionError } = await supabase
        .from('financial_transactions')
        .insert([transaction])
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Atualiza a validade do aluno
      const { error: studentError } = await supabase
        .from('students')
        .update({ 
          validity_date: validityDate.toISOString(),
          status: 'Ativo'
        })
        .eq('id', studentId);

      if (studentError) throw studentError;

      return transactionData as FinancialTransaction;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', data.student_id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      showSuccess('Mensalidade criada com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  return {
    createStudentTransaction: createStudentTransactionMutation,
    updateStudentCredit: updateStudentCreditMutation,
    markTransactionAsPaid: markTransactionAsPaidMutation,
    createMonthlyTransaction: createMonthlyTransactionMutation,
  };
};