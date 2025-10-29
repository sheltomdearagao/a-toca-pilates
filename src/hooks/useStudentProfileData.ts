import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/student';
import { FinancialTransaction } from '@/types/financial';
import { RecurringClassTemplate } from '@/types/schedule';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionProvider';
import { useState } from 'react'; // <-- Importação adicionada

type ClassAttendance = {
  id: string;
  status: string;
  classes: {
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
};

const PAGE_SIZE = 10;

const fetchStudentProfile = async (studentId: string, transactionLimit: number, attendanceLimit: number): Promise<Omit<StudentProfileData, 'student' | 'recurringTemplate'>> => {
  const [
    { data: transactions, error: transactionsError, count: transactionCount },
    { data: attendance, error: attendanceError, count: attendanceCount },
  ] = await Promise.all([
    supabase.from('financial_transactions')
      .select('*, students(name, phone)', { count: 'exact' })
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(transactionLimit),
    supabase.from('class_attendees')
      .select('id, status, classes!inner(title, start_time)', { count: 'exact' })
      .eq('student_id', studentId)
      .order('start_time', { foreignTable: 'classes', ascending: false })
      .limit(attendanceLimit),
  ]);

  if (transactionsError) throw new Error(`Erro ao carregar transações: ${transactionsError.message}`);
  if (attendanceError) throw new Error(`Erro ao carregar presença: ${attendanceError.message}`);

  return { 
    transactions: transactions || [], 
    attendance: (attendance as any) || [],
    hasMoreTransactions: (transactionCount ?? 0) > transactionLimit,
    hasMoreAttendance: (attendanceCount ?? 0) > attendanceLimit,
  };
};

export const useStudentProfileData = (studentId: string | undefined) => {
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const isAdmin = profile?.role === 'admin';
  
  const [transactionLimit, setTransactionLimit] = useState(PAGE_SIZE);
  const [attendanceLimit, setAttendanceLimit] = useState(PAGE_SIZE);

  const { data: profileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['studentProfileData', studentId],
    queryFn: async () => {
      const [
        { data: student, error: studentError },
        { data: recurringTemplate, error: templateError },
      ] = await Promise.all([
        supabase.from('students').select('*').eq('id', studentId!).single(),
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
    queryClient.invalidateQueries({ queryKey: ['studentProfile', studentId] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['financialStats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
  };

  const updateStudentMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const dataToSubmit = { ...formData };
      
      const registerPayment = dataToSubmit.register_payment;
      const paymentDueDate = dataToSubmit.payment_due_date;
      
      delete dataToSubmit.register_payment;
      delete dataToSubmit.payment_due_date;
      
      // Limpeza de campos opcionais/condicionais
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
      delete dataToSubmit.has_promotional_value; // Remover campo temporário do formulário

      if (dataToSubmit.date_of_birth === "") {
        dataToSubmit.date_of_birth = null;
      }
      if (dataToSubmit.validity_date === "") {
        dataToSubmit.validity_date = null;
      }
      if (dataToSubmit.email === "") {
        dataToSubmit.email = null;
      }
      if (dataToSubmit.phone === "") {
        dataToSubmit.phone = null;
      }
      if (dataToSubmit.address === "") {
        dataToSubmit.address = null;
      }
      if (dataToSubmit.guardian_phone === "") {
        dataToSubmit.guardian_phone = null;
      }
      if (dataToSubmit.notes === "") {
        dataToSubmit.notes = null;
      }

      // 1. Atualiza aluno
      const { error } = await supabase
        .from("students")
        .update(dataToSubmit)
        .eq("id", studentId!);
      if (error) throw error;
      
      // 2. Registrar Pagamento se marcado
      if (registerPayment && studentId && dataToSubmit.monthly_fee > 0) {
        const transaction = {
          user_id: user.id,
          student_id: studentId,
          description: `Mensalidade - ${dataToSubmit.plan_type} ${dataToSubmit.plan_frequency || ''}`,
          category: 'Mensalidade',
          amount: dataToSubmit.monthly_fee,
          type: 'revenue',
          status: 'Pago',
          due_date: paymentDueDate, // Data de vencimento para o próximo mês
          paid_at: new Date().toISOString(), // Data de pagamento é agora
        };
        
        const { error: transactionError } = await supabase.from('financial_transactions').insert([transaction]);
        if (transactionError) throw transactionError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', studentId] });
      queryClient.invalidateQueries({ queryKey: ["studentPaymentStatus"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      showSuccess(`Aluno atualizado com sucesso!`);
    },
    onError: (error: any) => { showError(error.message); },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      if (!isAdmin) throw new Error("Você não tem permissão para marcar transações como pagas.");
      const { error } = await supabase.from('financial_transactions').update({ status: 'Pago', paid_at: new Date().toISOString() }).eq('id', transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinancialQueries();
      showSuccess('Transação marcada como paga com sucesso!');
    },
    onError: (error) => { showError(error.message); },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      if (!isAdmin) throw new Error("Você não tem permissão para excluir transações.");
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
    },
    isLoading,
    isFetchingHistory,
    error,
    isAdmin,
    loadMoreTransactions,
    loadMoreAttendance,
    mutations: {
      updateStudent: updateStudentMutation,
      markAsPaid: markAsPaidMutation,
      deleteTransaction: deleteTransactionMutation,
    }
  };
};