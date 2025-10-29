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
import AddEditTransactionDialog from '@/components/financial/AddEditTransactionDialog';
import { useStudentProfileData } from '@/hooks/useStudentProfileData';

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [isProRataOpen, setProRataOpen] = useState(false);
  const [isAddClassOpen, setAddClassOpen] = useState(false);
  const [isEditFormOpen, setEditFormOpen] = useState(false);
  const [isDeleteTransactionAlertOpen, setDeleteTransactionAlertOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<FinancialTransaction | null>(null);

  // Novos estados
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

  const onSubmitTransaction = (formData: any) => {
    mutations.updateStudent.mutateAsync; // apenas placeholder
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

      {/* Novos botões */}
      <div className="flex gap-2">
        <button
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          onClick={() => handleRegister('revenue')}
        >
          Registrar Receita
        </button>
        <button
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          onClick={() => handleRegister('expense')}
        >
          Registrar Despesa
        </button>
      </div>

      <ColoredSeparator color="primary" className="my-6" />

      {/* ... resto do layout ... */}

      <AddEditTransactionDialog
        isOpen={isTransactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        initialStudentId={student?.id}
        defaultType={transactionDialogType}
        onSubmit={(data) => {
          // inserir via mutation
          setTransactionDialogOpen(false);
        }}
        isSubmitting={false}
      />
    </div>
  );
};

export default StudentProfile;