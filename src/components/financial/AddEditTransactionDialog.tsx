"use client";

import React, { useEffect } from 'react';
import type { TransactionFormData } from './AddEditTransactionDialog.schema';
import { transactionSchema } from './AddEditTransactionDialog.schema';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { PaymentStatus } from '@/types/financial'; // Importar PaymentStatus

export interface AddEditTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialStudentId?: string;
  defaultType?: 'revenue' | 'expense';
  defaultStatus?: PaymentStatus; // Novo prop
  onSubmit: (data: TransactionFormData) => void;
  isSubmitting: boolean;

  selectedTransaction?: any;
  students?: any[];
  isLoadingStudents?: boolean;
}

const AddEditTransactionDialog = ({
  isOpen,
  onOpenChange,
  initialStudentId,
  defaultType = 'revenue',
  defaultStatus = 'Pendente', // Usar Pendente como fallback
  onSubmit,
  isSubmitting,
  students = [],
  isLoadingStudents = false,
}: AddEditTransactionDialogProps) => {
  const { data: appSettings } = useAppSettings();

  const { control, handleSubmit, reset, watch } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: defaultType,
      student_id: initialStudentId ?? null,
      description: '',
      amount: 0,
      category: '',
      status: defaultStatus, // Usar defaultStatus
      due_date: null,
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        type: defaultType,
        student_id: initialStudentId ?? null,
        description: '',
        amount: 0,
        category: '',
        status: defaultStatus, // Usar defaultStatus no reset
        due_date: null,
      });
    }
  }, [isOpen, initialStudentId, defaultType, defaultStatus, reset]);

  const transactionType = watch('type');
  const isRevenue = transactionType === 'revenue';
  const isExpense = transactionType === 'expense';
  const isStudentSelected = !!watch('student_id');

  const categories = isRevenue ? appSettings?.revenue_categories : appSettings?.expense_categories;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transactionType === 'revenue' ? 'Registrar Receita' : 'Registrar Despesa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            {/* Tipo de Transação (Oculto se initialStudentId estiver presente, pois é sempre Receita) */}
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

            {/* Aluno (Apenas se não estiver fixo) */}
            {!initialStudentId && (
              <Controller
                name="student_id"
                control={control}
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Aluno</Label>
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
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      value={field.value === 0 ? '' : field.value}
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                      <SelectContent>
                        {categories?.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Status e Vencimento (Apenas para Receita) */}
            {isRevenue && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pago">Pago</SelectItem>
                          <SelectItem value="Pendente">Pendente</SelectItem>
                          <SelectItem value="Atrasado">Atrasado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Vencimento (Opcional)</Label>
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
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditTransactionDialog;
export type { TransactionFormData } from './AddEditTransactionDialog.schema';