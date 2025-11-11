import React, { useEffect, useState } from 'react';
import type { TransactionFormData } from './AddEditTransactionDialog.schema';
import { transactionSchema } from './AddEditTransactionDialog.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, DollarSign, Calendar } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { FinancialTransaction, PaymentStatus } from '@/types/financial';
import { format, parseISO } from 'date-fns';
import { showError } from '@/utils/toast';

export interface AddEditTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTransaction?: FinancialTransaction;
  initialStudentId?: string;
  defaultType?: 'revenue' | 'expense';
  defaultStatus?: PaymentStatus;
  onSubmit: (data: TransactionFormData) => void;
  isSubmitting: boolean;
  students?: { id: string; name: string }[];
  isLoadingStudents?: boolean;
}

const AddEditTransactionDialog = ({
  isOpen,
  onOpenChange,
  selectedTransaction,
  initialStudentId,
  defaultType = 'revenue',
  defaultStatus = 'Pendente',
  onSubmit,
  isSubmitting,
  students = [],
  isLoadingStudents = false,
}: AddEditTransactionDialogProps) => {
  const { data: appSettings } = useAppSettings();
  const [showDueDate, setShowDueDate] = useState(false);

  const { control, reset, watch, setValue, formState: { errors }, handleSubmit } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: defaultType,
      student_id: initialStudentId ?? null,
      description: '',
      amount: 0,
      category: '',
      status: defaultStatus,
      due_date: null,
    },
  });

  const transactionType = watch('type');
  const category = watch('category');

  // Controla a visibilidade do campo de data de vencimento
  useEffect(() => {
    const shouldShowDueDate = transactionType === 'revenue' && category === 'Mensalidade';
    setShowDueDate(shouldShowDueDate);
    if (!shouldShowDueDate) {
      setValue('due_date', null);
    }
  }, [transactionType, category, setValue]);

  useEffect(() => {
    if (isOpen) {
      if (selectedTransaction) {
        reset({
          type: selectedTransaction.type,
          student_id: selectedTransaction.student_id,
          description: selectedTransaction.description,
          amount: selectedTransaction.amount,
          category: selectedTransaction.category,
          status: selectedTransaction.status || 'Pendente',
          due_date: selectedTransaction.due_date ? format(parseISO(selectedTransaction.due_date), 'yyyy-MM-dd') : null,
        });
      } else {
        reset({
          type: defaultType,
          student_id: initialStudentId ?? null,
          description: '',
          amount: 0,
          category: '',
          status: defaultStatus,
          due_date: null,
        });
      }
    }
  }, [isOpen, selectedTransaction, initialStudentId, defaultStatus, reset]);

  const handleFormSubmit = (data: TransactionFormData) => {
    onSubmit(data);
  };

  const handleFormError = (validationErrors: any) => {
    const firstErrorKey = Object.keys(validationErrors)[0];
    if (firstErrorKey) {
      const error = validationErrors[firstErrorKey];
      const message = Array.isArray(error) ? error[0].message : error.message;
      showError(`Preencha o campo: ${message}`);
    }
  };

  const revenueCategories = appSettings?.revenue_categories || [];
  const expenseCategories = appSettings?.expense_categories || [];
  const currentCategories = transactionType === 'revenue' ? revenueCategories : expenseCategories;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selectedTransaction ? 'Editar Lançamento' : defaultType === 'revenue' ? 'Registrar Receita' : 'Registrar Despesa'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit, handleFormError)}>
          <div className="grid gap-4 py-4">
            {!initialStudentId && (
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Receita</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            )}

            {!initialStudentId && (
              <Controller
                name="student_id"
                control={control}
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Aluno (Opcional)</Label>
                    <Select
                      onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                      value={field.value ?? 'none'}
                      disabled={isLoadingStudents}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um aluno..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            )}

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Controller name="description" control={control} render={({ field }) => <Input {...field} />} />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Controller
                  name="amount"
                  control={control}
                  render={({ field }) => (
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      value={field.value || ''}
                    />
                  )}
                />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {currentCategories?.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
              </div>
            </div>

            {transactionType === 'revenue' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={(value: PaymentStatus) => field.onChange(value)} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pago">Pago</SelectItem>
                          <SelectItem value="Pendente">Pendente</SelectItem>
                          <SelectItem value="Atrasado">Atrasado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
                </div>
                
                {/* Campo de data de vencimento - apenas visível para Mensalidade */}
                {showDueDate && (
                  <div className="space-y-2">
                    <Label>Data de Vencimento</Label>
                    <Controller
                      name="due_date"
                      control={control}
                      render={({ field }) => (
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      )}
                    />
                    {errors.due_date && <p className="text-sm text-destructive">{errors.due_date.message}</p>}
                  </div>
                )}
              </div>
            )}

            {errors.root && <p className="text-red-600 text-sm">{errors.root.message}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedTransaction ? 'Atualizar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditTransactionDialog;