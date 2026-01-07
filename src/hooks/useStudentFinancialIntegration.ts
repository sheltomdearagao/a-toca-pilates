import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { FinancialTransaction } from '@/types/financial';
import { addDays, parseISO } from 'date-fns';

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

interface RegisterStudentPaymentParams {
  studentId: string;
  amount: number;
  planType: string;
  frequency?: string;
  paymentMethod?: string;
  dueDate: string; // Próximo vencimento do ciclo
  paidAt: string; // Data em que o pagamento foi feito
  validityDays: number;
  description: string;
  discountDescription?: string;
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

  // NOVA MUTATION: Registrar pagamento completo com atualização de validade
  const registerStudentPaymentMutation = useMutation({
    mutationFn: async (params: RegisterStudentPaymentParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const validityDate = addDays(parseISO(params.paidAt), params.validityDays).toISOString();

      // 1. Criar a transação financeira
      const transaction = {
        user_id: user.id,
        student_id: params.studentId,
        description: params.description,
        category: 'Mensalidade', // Sempre Mensalidade para este fluxo
        amount: params.amount,
        type: 'revenue' as const,
        status: 'Pago' as const, // Sempre Pago para este fluxo
        due_date: params.dueDate,
        paid_at: params.paidAt,
        payment_method: params.paymentMethod || null,
        is_recurring: params.planType !== 'Avulso',
      };

      const { data: newTransaction, error: transactionError } = await supabase
        .from('financial_transactions')
        .insert([transaction])
        .select()
        .single();

      if (transactionError) throw transactionError;

      // 2. Atualizar o aluno (validade, status, plano, etc.)
      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({
          validity_date: validityDate,
          status: 'Ativo', // Garante que o aluno fique ativo após o pagamento
          plan_type: params.planType,
          plan_frequency: params.frequency || null,
          monthly_fee: params.amount, // O valor total pago pode ser diferente da mensalidade base
          payment_method: params.paymentMethod || null,
          discount_description: params.discountDescription || null,
        })
        .eq('id', params.studentId);

      if (studentUpdateError) throw studentUpdateError;

      // 3. Atualizar ou criar assinatura (se for plano recorrente)
      if (params.planType !== 'Avulso') {
        // Tenta encontrar uma assinatura ativa existente
        const { data: existingSubscription, error: fetchSubError } = await supabase
          .from('subscriptions')
          .select('id, plan_id')
          .eq('student_id', params.studentId)
          .eq('status', 'active')
          .single();

        if (fetchSubError && fetchSubError.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error("Erro ao buscar assinatura existente:", fetchSubError);
          // Não lançar erro fatal, apenas logar
        }

        // Busca ou cria o plano
        const { data: planData, error: planError } = await supabase
          .from('plans')
          .select('id')
          .eq('name', params.planType)
          .single();

        let planId = planData?.id;
        if (planError && planError.code !== 'PGRST116') {
          console.error("Erro ao buscar plano:", planError);
          // Não lançar erro fatal
        }
        if (!planId) {
          const { data: newPlan, error: createPlanError } = await supabase
            .from('plans')
            .insert({
              name: params.planType,
              frequency: params.frequency ? parseInt(params.frequency) : 0,
              default_price: params.amount,
              active: true
            })
            .select('id')
            .single();
          if (createPlanError) console.error("Erro ao criar novo plano:", createPlanError);
          planId = newPlan?.id;
        }

        if (planId) {
          const subscriptionData = {
            student_id: params.studentId,
            plan_id: planId,
            price: params.amount,
            frequency: params.frequency ? parseInt(params.frequency) : 0,
            start_date: params.paidAt,
            end_date: validityDate,
            due_day: parseISO(params.dueDate).getDate(), // Dia do mês do vencimento
            status: 'active' as const,
          };

          if (existingSubscription) {
            // Atualiza a assinatura existente
            const { error: updateSubError } = await supabase
              .from('subscriptions')
              .update(subscriptionData)
              .eq('id', existingSubscription.id);
            if (updateSubError) console.error("Erro ao atualizar assinatura:", updateSubError);
          } else {
            // Cria uma nova assinatura
            const { error: insertSubError } = await supabase
              .from('subscriptions')
              .insert([subscriptionData]);
            if (insertSubError) console.error("Erro ao inserir nova assinatura:", insertSubError);
          }
        }
      }

      return newTransaction as FinancialTransaction;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', data.student_id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      queryClient.invalidateQueries({ queryKey: ['studentPaymentStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      showSuccess('Pagamento registrado e validade do aluno atualizada com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  return {
    createStudentTransaction: createStudentTransactionMutation,
    updateStudentCredit: updateStudentCreditMutation,
    markTransactionAsPaid: markTransactionAsPaidMutation,
    registerStudentPayment: registerStudentPaymentMutation, // Nova mutação
  };
};