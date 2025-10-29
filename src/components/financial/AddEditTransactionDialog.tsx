"use client";

import React, { useEffect } from 'react';
import { TransactionFormData, transactionSchema } from './AddEditTransactionDialog.schema';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';

export type { TransactionFormData };

export interface AddEditTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialStudentId?: string;
  defaultType?: 'revenue' | 'expense';
  onSubmit: (data: TransactionFormData) => void;
  isSubmitting: boolean;

  // Aceitar também os props que Financial.tsx passa
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
  students,
  isLoadingStudents,
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
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                  <div>
                    <RadioGroupItem value="revenue" id="rev" className="sr-only" />
                    <Label htmlFor="rev" className="cursor-pointer">Receita</Label>
                  </div>
                  <div>
                    <RadioGroupItem value="expense" id="exp" className="sr-only" />
                    <Label htmlFor="exp" className="cursor-pointer">Despesa</Label>
                  </div>
                </RadioGroup>
              )}
            />

            <Controller
              name="student_id"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>Aluno</Label>
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={isLoadingStudents}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{initialStudentId ? '(fixo)' : 'Nenhum'}</SelectItem>
                      {students?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Controller name="description" control={control} render={({ field }) => <Input {...field} />} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Controller name="amount" control={control} render={({ field }) => <Input type="number" step="0.01" {...field} />} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {transactionType === 'revenue'
                          ? appSettings?.revenue_categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)
                          : appSettings?.expense_categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {transactionType === 'revenue' && (
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Controller name="due_date" control={control} render={({ field }) => <Input type="date" {...field} />} />
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" type="button">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin mr-2" />}Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditTransactionDialog;