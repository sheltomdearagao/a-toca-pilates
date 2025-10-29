import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, ChevronsUpDown, Repeat } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, set, parseISO, addDays, addWeeks, startOfDay } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { StudentOption } from '@/types/student';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Segunda-feira' },
  { value: 'tuesday', label: 'Terça-feira' },
  { value: 'wednesday', label: 'Quarta-feira' },
  { value: 'thursday', label: 'Quinta-feira' },
  { value: 'friday', label: 'Sexta-feira' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

// Horários disponíveis (7h às 20h) - Apenas horas cheias
const availableHours = Array.from({ length: 14 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});

const classSchema = z.object({
  student_ids: z.array(z.string()).min(1, 'Selecione pelo menos um aluno.').max(10, 'Você pode selecionar até 10 alunos.'),
  title: z.string().optional(), // Título opcional, será gerado se houver alunos
  is_experimental: z.boolean().default(false),
  date: z.string().min(1, 'A data de início é obrigatória.'),
  time: z.string().regex(/^\d{2}:00$/, 'O horário deve ser em hora cheia (ex: 08:00).'),
  is_recurring_4_weeks: z.boolean().default(false), // Nova opção de recorrência
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  // Validação de Aula Experimental
  if (data.is_experimental && data.student_ids.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Aulas experimentais só podem ser agendadas para um único aluno.',
      path: ['student_ids'],
    });
  }
});

type ClassFormData = z.infer<typeof classSchema>;

interface AddClassDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  quickAddSlot?: { date: Date; hour: number } | null;
  preSelectedStudentId?: string;
}

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, enrollment_type')
    .order('name');
  
  if (error) throw new Error(error.message);
  return data || [];
};

const AddClassDialog = ({ isOpen, onOpenChange, quickAddSlot, preSelectedStudentId }: AddClassDialogProps) => {
  const queryClient = useQueryClient();
  
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_ids: preSelectedStudentId ? [preSelectedStudentId] : [],
      title: '',
      is_experimental: false,
      date: format(new Date(), 'yyyy-MM-dd'),
      time: quickAddSlot ? `${quickAddSlot.hour.toString().padStart(2, '0')}:00` : availableHours[0],
      is_recurring_4_weeks: false,
      notes: '',
    },
  });

  const selectedStudentIds = watch('student_ids');
  const isRecurring = watch('is_recurring_4_weeks');
  const isExperimental = watch('is_experimental');

  const { data: students, isLoading: isLoadingStudents } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isOpen) {
      const initialDate = quickAddSlot ? format(quickAddSlot.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const initialTime = quickAddSlot ? `${quickAddSlot.hour.toString().padStart(2, '0')}:00` : availableHours[0];
      
      reset({
        student_ids: preSelectedStudentId ? [preSelectedStudentId] : [],
        title: '',
        is_experimental: false,
        date: initialDate,
        time: initialTime,
        is_recurring_4_weeks: false,
        notes: '',
      });
    }
  }, [isOpen, quickAddSlot, preSelectedStudentId, reset]);

  const mutation = useMutation({
    mutationFn: async (formData: ClassFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const studentsToEnroll = formData.student_ids;
      const baseDate = parseISO(formData.date);
      const [hours, minutes] = formData.time.split(':');
      
      const classTitle = formData.title || (studentsToEnroll.length === 1 
        ? `Aula com ${students?.find(s => s.id === studentsToEnroll[0])?.name}` 
        : `Aula em Grupo (${studentsToEnroll.length} alunos)`);

      const classesToCreate: { date: Date; title: string }[] = [];
      
      // 1. Determinar as datas das aulas
      if (formData.is_recurring_4_weeks) {
        // Recorrência: 4 semanas (incluindo a semana atual)
        for (let i = 0; i < 4; i++) {
          const recurringDate = addWeeks(baseDate, i);
          classesToCreate.push({ date: recurringDate, title: classTitle });
        }
      } else {
        // Apenas uma aula
        classesToCreate.push({ date: baseDate, title: classTitle });
      }

      let totalClassesCreated = 0;

      // 2. Criar cada aula e matricular todos os alunos
      for (const classItem of classesToCreate) {
        const dateTime = set(classItem.date, {
          hours: parseInt(hours),
          minutes: parseInt(minutes),
          seconds: 0,
          milliseconds: 0,
        });
        
        // Converte para UTC (Supabase armazena em TIMESTAMPTZ)
        const startUtc = fromZonedTime(dateTime, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
        
        // Insere a aula principal
        const { data: newClass, error: classError } = await supabase
          .from('classes')
          .insert({
            user_id: user.id,
            title: class

O erro `A <Select.Item /> must have a value prop that is not an empty string` indica que um `Select.Item` está recebendo uma string vazia como `value`. Isso geralmente acontece quando o valor inicial de um `Select` controlado pelo `react-hook-form` é uma string vazia em vez de `null` ou `undefined`.

Vou corrigir isso garantindo que os valores dos `Select` sejam sempre `null` quando vazios, em vez de strings vazias.

<dyad-write path="src/components/financial/AddEditTransactionDialog.tsx" description="Corrigindo erro de Select.Item com valor vazio garantindo que valores vazios sejam null em vez de string vazia.">
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

export type { TransactionFormData } = {};

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
                  <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isLoadingStudents}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={undefined}>Nenhum</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {transactionType === 'revenue'
                          ? appSettings?.revenue_categories?.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)
                          : appSettings?.expense_categories?.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)
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
              <Button type="button" variant="secondary">Cancelar</Button>
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