import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FinancialTransaction } from '@/types/financial';
import { Loader2 } from 'lucide-react';
import ProRataCalculator from '@/components/students/ProRataCalculator';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import AddEditStudentDialog from '@/components/students/AddEditStudentDialog';
import DeleteTransactionAlertDialog from '@/components/financial/DeleteTransactionAlertDialog';
import ColoredSeparator from "@/components/ColoredSeparator";
import StudentHeaderActions from '@/components/students/profile/StudentHeaderActions';
import StudentDetailsCard from '@/components/students/profile/StudentDetailsCard';
import StudentRecurringScheduleCard from '@/components/students/profile/StudentRecurringScheduleCard';
import StudentFinancialHistory from '@/components/students/profile/StudentFinancialHistory';
import StudentAttendanceHistory from '@/components/students/profile/StudentAttendanceHistory';
import AddEditTransactionDialog, { TransactionFormData } from '@/components/financial/AddEditTransactionDialog';
import { useStudentProfileData } from '@/hooks/useStudentProfileData';
import { Button } from '@/components/ui/button'; // <-- Import adicionado

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [isProRataOpen, setProRataOpen] = useState(false);
  const [isAddClassOpen, setAddClassOpen] = useState(false);
  const [isEditFormOpen, setEditFormOpen] = useState(false);
  const [isDeleteTransactionAlertOpen, setDeleteTransactionAlertOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<FinancialTransaction | null>(null);

  // Novos estados para transação avulsa
  const [isTransactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionDialogType, setTransactionDialogType] = useState<'revenue' | 'expense'>('revenue');

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

  const handleRegister = (type: 'revenue' | 'expense') => {
    setTransactionDialogType(type);
    setTransactionDialogOpen(true);
  };

  const onSubmitTransaction = (formData: TransactionFormData) => {
    mutations.createTransaction.mutate(formData, {
      onSuccess: () => {
        setTransactionDialogOpen(false);
      }
    });
  };

  const handleDeleteTransaction = (transaction: FinancialTransaction) => {
    setTransactionToDelete(transaction);
    setDeleteTransactionAlertOpen(true);
  };

  const handleConfirmDeleteTransaction = () => {
    if (transactionToDelete) {
      mutations.deleteTransaction.mutate(transactionToDelete.id, {
        onSuccess: () => {
          setDeleteTransactionAlertOpen(false);
          setTransactionToDelete(null);
        },
      });
    }
  };

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

      {/* Botões de Registro de Transação */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="bg-green-500 hover:bg-green-600 text-white"
          onClick={() => handleRegister('revenue')}
        >
          Registrar Receita Avulsa
        </Button>
        <Button
          variant="outline"
          className="bg-red-500 hover:bg-red-600 text-white"
          onClick={() => handleRegister('expense')}
        >
          Registrar Despesa Avulsa
        </Button>
      </div>

      <ColoredSeparator color="primary" className="my-6" />

      <div className="grid lg:grid-cols-4 gap-6">
        <StudentDetailsCard student={student} isLoading={isLoading} />
        <StudentRecurringScheduleCard student={student} recurringTemplate={recurringTemplate} isLoading={isLoading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <StudentFinancialHistory
          transactions={transactions}
          isLoading={isLoading}
          isAdmin={isAdmin}
          onMarkAsPaid={(id) => mutations.markAsPaid.mutate(id)}
          onDeleteTransaction={handleDeleteTransaction}
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

      {/* Diálogos */}
      <AddEditStudentDialog
        isOpen={isEditFormOpen}
        onOpenChange={setEditFormOpen}
        selectedStudent={student}
        onSubmit={(data) => mutations.updateStudent.mutate(data, { onSuccess: () => setEditFormOpen(false) })}
        isSubmitting={mutations.updateStudent.isPending}
      />

      {student && (
        <ProRataCalculator
          isOpen={isProRataOpen}
          onOpenChange={setProRataOpen}
          student={student}
        />
      )}

      <AddClassDialog
        isOpen={isAddClassOpen}
        onOpenChange={setAddClassOpen}
        preSelectedStudentId={studentId}
      />

      <AddEditTransactionDialog
        isOpen={isTransactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        initialStudentId={studentId}
        defaultType={transactionDialogType}
        onSubmit={onSubmitTransaction}
        isSubmitting={mutations.createTransaction.isPending}
        // Passando lista de alunos vazia, pois o aluno já está fixo
        students={[]}
        isLoadingStudents={false}
      />

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