import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/student';
import { FinancialTransaction } from '@/types/financial';
import { RecurringClassTemplate } from '@/types/schedule';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionProvider';

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
};

const fetchStudentProfile = async (studentId: string): Promise<StudentProfileData> => {
  const [
    { data: student, error: studentError },
    { data: transactions, error: transactionsError },
    { data: attendance, error: attendanceError },
    { data: recurringTemplate, error: templateError },
  ] = await Promise.all([
    supabase.from('students').select('*').eq('id', studentId).single(),
    supabase.from('financial_transactions').select('*, students(name, phone)').eq('student_id', studentId).order('created_at', { ascending: false }).limit(10), // LIMITADO A 10
    supabase.from('class_attendees').select('id, status, classes!inner(title, start_time)').eq('student_id', studentId).order('start_time', { foreignTable: 'classes', ascending: false }).limit(10), // LIMITADO A 10
    supabase.from('recurring_class_templates').select('*').eq('student_id', studentId).single(),
  ]);

  if (studentError) throw new Error(`Erro ao carregar dados do aluno: ${studentError.message}`);
  if (transactionsError) throw new Error(`Erro ao carregar transações: ${transactionsError.message}`);
  if (attendanceError) throw new Error(`Erro ao carregar presença: ${attendanceError.message}`);
  if (templateError && templateError.code !== 'PGRST116') {
    console.error("Erro ao carregar template recorrente:", templateError);
  }

  return { 
    student: student!, 
    transactions: transactions || [], 
    attendance: (attendance as any) || [],
    recurringTemplate: recurringTemplate || null,
  };
};

export const useStudentProfileData = (studentId: string | undefined) => {
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const isAdmin = profile?.role === 'admin';

  const { data, isLoading, error } = useQuery<StudentProfileData, Error>({
    queryKey: ['studentProfile', studentId],
    queryFn: () => fetchStudentProfile(studentId!),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2,
  });

  const invalidateFinancialQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['studentProfile', studentId] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['financialStats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
  };

  const updateStudentMutation = useMutation({
    mutationFn: async (formData: any) => {
      const dataToSubmit = { ...formData };
      if (dataToSubmit.date_of_birth === "") {
        dataToSubmit.date_of_birth = null;
      }
      if (dataToSubmit.validity_date === "") {
        dataToSubmit.validity_date = null;
      }
      if (dataToSubmit.plan_type === 'Avulso') {
        dataToSubmit.plan_frequency = null;
        dataToSubmit.payment_method = null;
        dataToSubmit.monthly_fee = 0;
      }

      const { error } = await supabase
        .from("students")
        .update(dataToSubmit)
        .eq("id", studentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentProfile', studentId] });
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

  return {
    data,
    isLoading,
    error,
    isAdmin,
    mutations: {
      updateStudent: updateStudentMutation,
      markAsPaid: markAsPaidMutation,
      deleteTransaction: deleteTransactionMutation,
    }
  };
};