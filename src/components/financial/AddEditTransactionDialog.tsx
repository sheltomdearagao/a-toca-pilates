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

export interface AddEditTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialStudentId?: string;
  defaultType?: 'revenue' | 'expense';
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
      status: 'Pendente',
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
        status: 'Pendente',
        due_date: null,
      });
    }
  }, [isOpen, initialStudentId, defaultType, reset]);

  const transactionType = watch('type');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transactionType === 'revenue' ? 'Registrar Receita' : 'Registrar Despesa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            {/* ... other fields ... */}

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

            {/* ... remaining fields ... */}
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