import React, { useState, useMemo } from 'react';
import { useInstructors } from '@/hooks/useInstructors';
import { Instructor } from '@/types/instructor';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColoredSeparator } from '@/components/ColoredSeparator';
import InstructorsTable from '@/components/instructors/InstructorsTable';
import AddEditInstructorDialog from '@/components/instructors/AddEditInstructorDialog';
import DeleteInstructorAlertDialog from '@/components/instructors/DeleteInstructorAlertDialog';
import AddEditTransactionDialog from '@/components/financial/AddEditTransactionDialog';
import { TransactionFormData } from '@/components/financial/AddEditTransactionDialog.schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionProvider';
import { Navigate } from 'react-router-dom';
import { InstructorFormData } from '@/hooks/useInstructors'; // Importando InstructorFormData

const Instructors = () => {
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const isAdminOrRecepcao = profile?.role === 'admin' || profile?.role === 'recepcao';

  // Redirect if not authorized
  if (!isAdminOrRecepcao) {
    return <Navigate to="/" replace />;
  }

  const { instructors, isLoading, addInstructor, updateInstructor, deleteInstructor } = useInstructors();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Instructor['status']>('all');

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [instructorForPayment, setInstructorForPayment] = useState<Instructor | null>(null);

  const filteredInstructors = useMemo(() => {
    if (!instructors) return [];
    
    const term = searchTerm.toLowerCase().trim();
    
    return instructors.filter(instructor => {
      const matchesSearchTerm = term === '' ||
        instructor.name.toLowerCase().includes(term) ||
        (instructor.email && instructor.email.toLowerCase().includes(term)) ||
        (instructor.phone && instructor.phone.toLowerCase().includes(term));
        
      const matchesStatus = filterStatus === 'all' || instructor.status === filterStatus;
      
      return matchesSearchTerm && matchesStatus;
    });
  }, [instructors, searchTerm, filterStatus]);

  const handleAddInstructor = () => {
    setSelectedInstructor(null);
    setIsAddEditOpen(true);
  };

  const handleEditInstructor = (instructor: Instructor) => {
    setSelectedInstructor(instructor);
    setIsAddEditOpen(true);
  };

  const handleDeleteInstructor = (instructor: Instructor) => {
    setSelectedInstructor(instructor);
    setIsDeleteAlertOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedInstructor) {
      deleteInstructor.mutate(selectedInstructor.id, {
        onSuccess: () => {
          setIsDeleteAlertOpen(false);
          setSelectedInstructor(null);
        },
      });
    }
  };

  const handleSubmitInstructor = (data: InstructorFormData) => {
    if (selectedInstructor) {
      updateInstructor.mutate({ id: selectedInstructor.id, ...data }, {
        onSuccess: () => setIsAddEditOpen(false),
      });
    } else {
      addInstructor.mutate(data, {
        onSuccess: () => setIsAddEditOpen(false),
      });
    }
  };

  const handleLaunchPayment = (instructor: Instructor) => {
    setInstructorForPayment(instructor);
    setIsPaymentDialogOpen(true);
  };

  const createPaymentMutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const transactionData = {
        user_id: user.id,
        description: formData.description,
        category: formData.category,
        amount: formData.amount,
        type: 'expense' as const, // Always an expense for instructor payments
        status: formData.status,
        due_date: formData.due_date,
        paid_at: formData.status === 'Pago' ? new Date().toISOString() : null,
        // No student_id for instructor payments
      };

      const { error } = await supabase.from('financial_transactions').insert([transactionData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      showSuccess('Pagamento de instrutor registrado com sucesso!');
      setIsPaymentDialogOpen(false);
      setInstructorForPayment(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const onSubmitPayment = (formData: TransactionFormData) => {
    createPaymentMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-primary rounded-xl">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestão de Instrutores</h1>
            <p className="text-muted-foreground">
              {instructors?.length || 0} instrutores cadastrados
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAddInstructor}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Adicionar Instrutor
          </Button>
        </div>
      </div>

      <ColoredSeparator color="primary" />

      <Card className="shadow-impressionist shadow-subtle-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Férias">Férias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <InstructorsTable
        instructors={filteredInstructors}
        isLoading={isLoading}
        onEdit={handleEditInstructor}
        onDelete={handleDeleteInstructor}
        onLaunchPayment={handleLaunchPayment}
      />

      <AddEditInstructorDialog
        isOpen={isAddEditOpen}
        onOpenChange={setIsAddEditOpen}
        selectedInstructor={selectedInstructor}
        onSubmit={handleSubmitInstructor}
        isSubmitting={addInstructor.isPending || updateInstructor.isPending}
      />

      <DeleteInstructorAlertDialog
        isOpen={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
        selectedInstructorName={selectedInstructor?.name}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={deleteInstructor.isPending}
      />

      {instructorForPayment && (
        <AddEditTransactionDialog
          isOpen={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          defaultType="expense"
          defaultStatus="Pendente"
          initialStudentId={null} // No student for instructor payments
          onSubmit={onSubmitPayment}
          isSubmitting={createPaymentMutation.isPending}
          students={[]} // No students needed for this dialog context
        />
      )}
    </div>
  );
};

export default Instructors;