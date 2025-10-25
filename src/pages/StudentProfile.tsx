import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FinancialTransaction } from '@/types/financial';
import { Loader2 } from 'lucide-react';
import ProRataCalculator from '../components/students/ProRataCalculator';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import AddEditStudentDialog from '@/components/students/AddEditStudentDialog';
import DeleteTransactionAlertDialog from '@/components/financial/DeleteTransactionAlertDialog';
import ColoredSeparator from "@/components/ColoredSeparator";
import StudentHeaderActions from '@/components/students/profile/StudentHeaderActions';
import StudentDetailsCard from '@/components/students/profile/StudentDetailsCard';
import StudentRecurringScheduleCard from '@/components/students/profile/StudentRecurringScheduleCard';
import StudentFinancialHistory from '@/components/students/profile/StudentFinancialHistory';
import StudentAttendanceHistory from '@/components/students/profile/StudentAttendanceHistory';
import { useStudentProfileData } from '@/hooks/useStudentProfileData';

const StudentProfile = () => {
  // --- HOOKS DE ESTADO E CONTEXTO ---
  const { studentId } = useParams<{ studentId: string }>();
  const [isProRataOpen, setProRataOpen] = useState(false);
  const [isAddClassOpen, setAddClassOpen] = useState(false);
  const [isEditFormOpen, setEditFormOpen] = useState(false);
  const [isDeleteTransactionAlertOpen, setDeleteTransactionAlertOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<FinancialTransaction | null>(null);
  
  // --- HOOK DE DADOS E MUTAÇÕES ---
  const { 
    data, 
    isLoading, 
    isFetchingHistory, 
    error, 
    isAdmin, 
    mutations, 
    loadMoreTransactions, 
    loadMoreAttendance 
  } = useStudentProfileData(studentId);

  const student = data?.student;
  const transactions = data?.transactions || [];
  const attendance = data?.attendance || [];
  const recurringTemplate = data?.recurringTemplate;
  const hasMoreTransactions = data?.hasMoreTransactions ?? false;
  const hasMoreAttendance = data?.hasMoreAttendance ?? false;

  // --- HANDLERS DE AÇÃO ---
  const handleEditSubmit = useCallback(async (formData: any) => {
    await mutations.updateStudent.mutateAsync(formData);
    setEditFormOpen(false);
  }, [mutations.updateStudent]);

  const handleDeleteTransactionClick = useCallback((transaction: FinancialTransaction) => {
    setTransactionToDelete(transaction);
    setDeleteTransactionAlertOpen(true);
  }, []);

  const handleConfirmDeleteTransaction = useCallback(() => {
    if (transactionToDelete) {
      mutations.deleteTransaction.mutate(transactionToDelete.id);
      setDeleteTransactionAlertOpen(false); // Fechar após iniciar a mutação
    }
  }, [transactionToDelete, mutations.deleteTransaction]);

  // --- RENDERIZAÇÃO CONDICIONAL ---
  if (error) {
    return <div className="text-center text-destructive">Erro ao carregar o perfil do aluno: {error.message}</div>;
  }
  
  if (!studentId) {
    return <div className="text-center text-destructive">ID do aluno não fornecido.</div>;
  }

  return (
    <div className="space-y-6">
      <StudentHeaderActions
        student={student}
        isLoading={isLoading}
        isAdmin={isAdmin}
        onEdit={() => setEditFormOpen(true)}
        onProRata={() => setProRataOpen(true)}
        onAddClass={() => setAddClassOpen(true)}
      />

      <ColoredSeparator color="primary" className="my-6" />

      <div className="grid gap-6 lg:grid-cols-3">
        <StudentDetailsCard student={student} isLoading={isLoading} />
        
        <StudentRecurringScheduleCard 
          student={student} 
          recurringTemplate={recurringTemplate} 
          isLoading={isLoading} 
        />

        <StudentFinancialHistory
          transactions={transactions}
          isLoading={isLoading}
          isAdmin={isAdmin}
          onMarkAsPaid={mutations.markAsPaid.mutate}
          onDeleteTransaction={handleDeleteTransactionClick}
          hasMore={hasMoreTransactions}
          onLoadMore={loadMoreTransactions}
          isFetching={isFetchingHistory}
        />

        <StudentAttendanceHistory
          attendance={attendance}
          isLoading={isLoading}
          hasMore={hasMoreAttendance}
          onLoadMore={loadMoreAttendance}
          isFetching={isFetchingHistory}
        />
      </div>
      
      {/* Diálogos Modais */}
      {student && <ProRataCalculator isOpen={isProRataOpen} onOpenChange={setProRataOpen} student={student} />}
      {student && <AddClassDialog isOpen={isAddClassOpen} onOpenChange={setAddClassOpen} preSelectedStudentId={student.id} />}
      {student && (
        <AddEditStudentDialog
          isOpen={isEditFormOpen}
          onOpenChange={setEditFormOpen}
          selectedStudent={student}
          onSubmit={handleEditSubmit}
          isSubmitting={mutations.updateStudent.isPending}
        />
      )}
      <DeleteTransactionAlertDialog
        isOpen={isDeleteTransactionAlertOpen}
        onOpenChange={setDeleteTransactionAlertOpen}
        selectedTransaction={transactionToDelete}
        onConfirmDelete={handleConfirmDeleteTransaction}
        isDeleting={mutations.deleteTransaction.isPending}
      />
    </div>
  );
};

export default StudentProfile;