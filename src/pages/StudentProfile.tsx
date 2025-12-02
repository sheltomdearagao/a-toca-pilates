import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FinancialTransaction } from '@/types/financial';
import { Loader2, DollarSign } from 'lucide-react';
import ProRataCalculator from '@/components/students/ProRataCalculator';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import AddEditStudentDialog from '@/components/students/AddEditStudentDialog';
import DeleteTransactionAlertDialog from '@/components/financial/DeleteTransactionAlertDialog';
import { ColoredSeparator } from "@/components/ColoredSeparator";
import StudentHeaderActions from '@/components/students/profile/StudentHeaderActions';
import StudentDetailsCard from '@/components/students/profile/StudentDetailsCard';
import StudentRecurringScheduleCard from '@/components/students/profile/StudentRecurringScheduleCard';
import StudentFinancialHistory from '@/components/students/profile/StudentFinancialHistory';
import StudentAttendanceHistory from '@/components/students/profile/StudentAttendanceHistory';
import AddEditTransactionDialog from '@/components/financial/AddEditTransactionDialog';
import { TransactionFormData } from '@/components/financial/AddEditTransactionDialog.schema';
import { useStudentProfileData } from '@/hooks/useStudentProfileData';
import { Button } from '@/components/ui/button';
import StudentRepositionCreditsCard from '@/components/students/profile/StudentRepositionCreditsCard';

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [isProRataOpen, setProRataOpen] = useState(false);
  const [isAddClassOpen, setAddClassOpen] = useState(false);
  const [isEditFormOpen, setEditFormOpen] = useState(false);
  const [isDeleteTransactionAlertOpen, setDeleteTransactionAlertOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<FinancialTransaction | null>(null);

  const [isTransactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<FinancialTransaction | undefined>(undefined);

  const { 
    data, 
    isLoading, 
    isFetchingHistory, 
    error, 
    isAdminOrRecepcao,
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
  const activePlan = data?.activePlan;
  const activePrice = data?.activePrice;
  const activeFrequency = data?.activeFrequency;

  const handleRegisterPayment = () => {
    setTransactionToEdit(undefined);
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
        isAdmin={isAdminOrRecepcao}
        onEdit={() => setEditFormOpen(true)}
        onProRata={() => setProRataOpen(true)}
        onAddClass={() => setAddClassOpen(true)}
      />

      <div className="flex gap-2">
        <Button
          className="bg-primary hover:bg-primary/90 text-white"
          onClick={handleRegisterPayment}
        >
          <DollarSign className="w-4 h-4 mr-2" /> Registrar Pagamento
        </Button>
      </div>

      <ColoredSeparator color="primary" className="my-6" />

      <div className="grid lg:grid-cols-4 gap-6">
        <StudentDetailsCard student={student} isLoading={isLoading} />
        <StudentRepositionCreditsCard studentId={studentId} isAdmin={isAdminOrRecepcao} />
        <StudentRecurringScheduleCard student={student} recurringTemplate={recurringTemplate} isLoading={isLoading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <StudentFinancialHistory
          transactions={transactions}
          isLoading={isLoading}
          isAdminOrRecepcao={isAdminOrRecepcao}
          onMarkAsPaid={(id) => mutations.markAsPaid.mutate(id)}
          onDeleteTransaction={handleDeleteTransaction}
          hasMore={hasMoreTransactions}
          onLoadMore={loadMoreTransactions}
          isFetching={isFetchingHistory}
          studentId={studentId}
        />
        <StudentAttendanceHistory
          attendance={attendance}
          isLoading={isLoading}
          hasMore={hasMoreAttendance}
          onLoadMore={loadMoreAttendance}
          isFetching={isFetchingHistory}
          studentId={studentId}
        />
      </div>

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
        defaultType={'revenue'}
        defaultStatus={'Pago'}
        onSubmit={onSubmitTransaction}
        isSubmitting={mutations.createTransaction.isPending}
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