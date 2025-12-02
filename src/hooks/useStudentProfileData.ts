import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/student';
import { FinancialTransaction } from '@/types/financial';
import { RecurringClassTemplate } from '@/types/schedule';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionProvider';
import { useState } from 'react';
import { TransactionFormData } from '@/components/financial/AddEditTransactionDialog.schema';
import { addDays, parseISO, isPast } from 'date-fns';

type ClassAttendance = {
  id: string;
  status: string;
  classes: {
    id: string;
    title: string;
    start_time: string;
  };
};

export type StudentProfileData = {
  student: Student;
  transactions: FinancialTransaction[];
  attendance: ClassAttendance[];
  recurringTemplate: RecurringClassTemplate | null;
  hasMoreTransactions: boolean;
  hasMoreAttendance: boolean;
  activePlan: string | null;
  activePrice: number | null;
  activeFrequency: number | null;
};

const PAGE_SIZE = 10;

const fetchStudentProfile = async (studentId: string, transactionLimit: number, attendanceLimit: number): Promise<Omit<StudentProfileData, 'student' | 'recurringTemplate'>> => {
  const [
    { data: transactions, error: transactionsError, count: transactionCount },
    { data: attendance, error: attendanceError, count: attendanceCount },
    { data: activeSubscription, error: subscriptionError },
  ] = await Promise.all([
    supabase.from('financial_transactions')
      .select('*, students(name, phone)', { count: 'exact' })
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(transactionLimit),
    supabase.from('class_attendees')
      .select('id, status, classes!inner(id, title, start_time)', { count: 'exact' })
      .eq('student_id', studentId)
      .order('start_time', { foreignTable: 'classes', ascending: false }) // ORDENAÇÃO: Mais recente primeiro
      .limit(attendanceLimit),
    supabase.from('subscriptions')
      .select('price, frequency, plans (name)')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1),
  ]);

  if (transactionsError) throw new Error(`Erro ao carregar transações: ${transactionsError.message}`);
  if (attendanceError) throw new Error(`Erro ao carregar presença: ${attendanceError.message}`);
  if (subscriptionError) console.error("Erro ao carregar assinatura ativa:", subscriptionError);

  const activePlan = activeSubscription?.[0]?.plans?.[0]?.name || null;
  const activePrice = activeSubscription?.[0]?.price || null;
  const activeFrequency = activeSubscription?.[0]?.frequency || null;

  return { 
    transactions: transactions || [], 
    attendance: (attendance as any) || [],
    hasMoreTransactions: (transactionCount ?? 0) > transactionLimit,
    hasMoreAttendance: (attendanceCount ?? 0) > attendanceLimit,
    activePlan,
    activePrice,
    activeFrequency,
  };
};

export const useStudentProfileData = (studentId: string | undefined) => {
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const isAdminOrRecepcao = profile?.role === 'admin' || profile?.role === 'recepcao';
  
  const [transactionLimit, setTransactionLimit] = useState(PAGE_SIZE);
  const [attendanceLimit, setAttendanceLimit] = useState(PAGE_SIZE);

  const { data: profileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['studentProfileData', studentId],
    queryFn: async () => {
      const [
        { data: student, error: studentError },
        { data: recurringTemplate, error: templateError },
      ] = await Promise.all([
        supabase.from('students').select('*, subscriptions(price, frequency, status, plans(name))').eq('id', studentId!).single(),
        supabase.from('recurring_class_templates').select('*').eq('student_id', studentId!).single(),
      ]);

      if (studentError) throw new Error(`Erro ao carregar dados do aluno: ${studentError.message}`);
      if (templateError && templateError.code !== 'PGRST116') {
        console.error("Erro ao carregar template recorrente:", templateError);
      }

      return {
        student: student!,
        recurringTemplate: recurringTemplate || null,
      };
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2,
  });

  const { data: historyData, isLoading: isLoadingHistory, error: historyError, isFetching: isFetchingHistory } = useQuery({
    queryKey: ['studentHistory', studentId, transactionLimit, attendanceLimit],
    queryFn: () => fetchStudentProfile(studentId!, transactionLimit, attendanceLimit),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = isLoadingProfile || isLoadingHistory;
  const error = profileError || historyError;

  const invalidateFinancialQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['studentProfileData', studentId] });
    queryClient.invalidateQueries({ queryKey: ['studentHistory', studentId] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['financialStats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
  };

  const updateStudentMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const dataToSubmit = { ...formData };
      
      const paymentDate = dataToSubmit.payment_date;
      const validityDuration = dataToSubmit.validity_duration;
      
      delete dataToSubmit.payment_date;
      delete dataToSubmit.validity_duration;
      
      const isParticularRecorrente = dataToSubmit.enrollment_type === 'Particular' && dataToSubmit.plan_type !== 'Avulso';

      // Lógica de cálculo da validade e status
      if (isParticularRecorrente && paymentDate && validityDuration) {
        const paymentDateObj = parseISO(paymentDate);
        const validityDate = addDays(paymentDateObj, validityDuration).toISOString();
        dataToSubmit.validity_date = validityDate;
        
        // Se a validade for no futuro, o aluno está Ativo (a menos que seja Bloqueado/Experimental)
        if (!isPast(parseISO(validityDate)) && dataToSubmit.status !== 'Bloqueado' && dataToSubmit.status !== 'Experimental') {
          dataToSubmit.status = 'Ativo';
        } else if (isPast(parseISO(validityDate))) {
          dataToSubmit.status = 'Inativo';
        }
      } else {
        // Para Avulso, Wellhub, TotalPass ou se faltarem dados, a validade é nula
        dataToSubmit.validity_date = null;
      }
      
      if (dataToSubmit.plan_type === 'Avulso') {
        dataToSubmit.plan_frequency = null;
        dataToSubmit.payment_method = null;
        dataToSubmit.monthly_fee = 0;
        dataToSubmit.preferred_days = null;
        dataToSubmit.preferred_time = null;
      }
      
      if (!dataToSubmit.has_promotional_value) {
        dataToSubmit.discount_description = null;
      }
      delete dataToSubmit.has_promotional_value;

      if (dataToSubmit.date_of_birth === "") dataToSubmit.date_of_birth = null;
      if (dataToSubmit.email === "") dataToSubmit.email = null;
      if (dataToSubmit.phone === "") dataToSubmit.phone = null;
      if (dataToSubmit.address === "") dataToSubmit.address = null;
      if (dataToSubmit.guardian_phone === "") dataToSubmit.guardian_phone = null;
      if (dataToSubmit.notes === "") dataToSubmit.notes = null;

      const { error } = await supabase
        .from("students")
        .update(dataToSubmit)
        .eq("id", studentId!);
      if (error) throw error;
      
      // Registrar Transação (Apenas se for novo aluno e tiver valor)
      if (!profileData?.student && studentId && dataToSubmit.monthly_fee > 0 && isParticularRecorrente) {
        const transaction = {
          user_id: user.id,
          student_id: studentId,
          description: `Mensalidade - ${dataToSubmit.plan_type} ${dataToSubmit.plan_frequency || ''}`,
          category: 'Mensalidade',
          amount: dataToSubmit.monthly_fee,
          type: 'revenue',
          status: 'Pago',
          due_date: dataToSubmit.validity_date, // Próximo vencimento
          paid_at: paymentDate, // Data de pagamento
        };
        
        const { error: transactionError } = await supabase.from('financial_transactions').insert([transaction]);
        if (transactionError) throw transactionError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', studentId] });
      queryClient.invalidateQueries({ queryKey: ["studentPaymentStatus"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ['birthdayStudents'] });
      showSuccess(`Aluno atualizado com sucesso!`);
    },
    onError: (error: any) => { showError(error.message); },
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const transactionData = {
        user_id: user.id,
        student_id: formData.student_id,
        description: formData.description,
        category: formData.category,
        amount: formData.amount,
        type: formData.type,
        status: formData.status,
        due_date: formData.due_date,
        paid_at: formData.status === 'Pago' ? new Date().toISOString() : null,
      };

      const { error } = await supabase.from('financial_transactions').insert([transactionData]);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinancialQueries();
      queryClient.invalidateQueries({ queryKey: ['birthdayStudents'] });
      showSuccess('Lançamento financeiro registrado com sucesso!');
    },
    onError: (error) => { showError(error.message); },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      if (!isAdminOrRecepcao) throw new Error("Você não tem permissão para marcar transações como pagas.");
      
      // Apenas marca a transação como paga. A atualização da validade do aluno deve ser feita manualmente
      // ou através do fluxo de edição do aluno, onde a duração da validade é conhecida.
      const { error } = await supabase.from('financial_transactions').update({ status: 'Pago', paid_at: new Date().toISOString() }).eq('id', transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinancialQueries();
      showSuccess('Transação marcada como paga com sucesso! Lembre-se de atualizar a validade do aluno, se necessário.');
    },
    onError: (error) => { showError(error.message); },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      if (!isAdminOrRecepcao) throw new Error("Você não tem permissão para excluir transações.");
      const { error } = await supabase.from("financial_transactions").delete().eq("id", transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinancialQueries();
      showSuccess("Lançamento removido com sucesso!");
    },
    onError: (error) => { showError(error.message); },
  });

  const loadMoreTransactions = () => {
    setTransactionLimit(prev => prev + PAGE_SIZE);
  };

  const loadMoreAttendance = () => {
    setAttendanceLimit(prev => prev + PAGE_SIZE);
  };

  return {
    data: {
      student: profileData?.student,
      recurringTemplate: profileData?.recurringTemplate,
      transactions: historyData?.transactions || [],
      attendance: historyData?.attendance || [],
      hasMoreTransactions: historyData?.hasMoreTransactions ?? false,
      hasMoreAttendance: historyData?.hasMoreAttendance ?? false,
      activePlan: historyData?.activePlan,
      activePrice: historyData?.activePrice,
      activeFrequency: historyData?.activeFrequency,
    },
    isLoading,
    isFetchingHistory,
    error,
    isAdminOrRecepcao,
    loadMoreTransactions,
    loadMoreAttendance,
    mutations: {
      updateStudent: updateStudentMutation,
      createTransaction: createTransactionMutation,
      markAsPaid: markAsPaidMutation,
      deleteTransaction: deleteTransactionMutation,
    }
  };
};