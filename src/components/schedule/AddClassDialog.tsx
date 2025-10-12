import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz'; // Importar date-fns-tz
import { Student, StudentOption } from '@/types/student';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const classSchema = z.object({
  student_id: z.string().optional().nullable(),
  title: z.string().min(3, 'O título é obrigatório.').optional(),
  start_time: z.string().min(1, 'A data e hora de início são obrigatórias.'),
  end_time: z.string().min(1, 'A data e hora de fim são obrigatórias.'),
  notes: z.string().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_days_of_week: z.array(z.string()).optional(),
  recurrence_start_date: z.string().optional(),
  recurrence_end_date: z.string().optional().nullable(), // Permitir null
}).superRefine((data, ctx) => {
  if (!data.is_recurring) {
    const startTime = parseISO(data.start_time);
    const endTime = parseISO(data.end_time);
    if (endTime <= startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A hora de fim deve ser posterior à hora de início.',
        path: ['end_time'],
      });
    }
  } else {
    if (!data.recurrence_days_of_week || data.recurrence_days_of_week.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecione pelo menos um dia da semana para aulas recorrentes.',
        path: ['recurrence_days_of_week'],
      });
    }
    if (!data.recurrence_start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A data de início da recorrência é obrigatória.',
        path: ['recurrence_start_date'],
      });
    }
    if (data.recurrence_end_date && new Date(data.recurrence_end_date) < new Date(data.recurrence_start_date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A data de término da recorrência deve ser posterior à data de início.',
        path: ['recurrence_end_date'],
      });
    }
  }
  // If student_id is selected, title is optional. If no student_id, title is required.
  if (!data.student_id && (!data.title || data.title.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O título da aula é obrigatório se nenhum aluno for selecionado.',
      path: ['title'],
    });
  }
});

type ClassFormData = z.infer<typeof classSchema>;

interface AddClassDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialStudentId?: string;
}

const daysOfWeek = [
  { label: 'Seg', value: 'monday' },
  { label: 'Ter', value: 'tuesday' },
  { label: 'Qua', value: 'wednesday' },
  { label: 'Qui', value: 'thursday' },
  { label: 'Sex', value: 'friday' },
  { label: 'Sáb', value: 'saturday' },
  { label: 'Dom', value: 'sunday' },
];

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase.from('students').select('id, name, enrollment_type').order('name');
  if (error) throw new Error(error.message);
  return data || [];
};

const AddClassDialog = ({ isOpen, onOpenChange, initialStudentId }: AddClassDialogProps) => {
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_id: initialStudentId || null,
      title: '',
      start_time: '',
      end_time: '',
      notes: '',
      is_recurring: false,
      recurrence_days_of_week: [],
      recurrence_start_date: format(new Date(), 'yyyy-MM-dd'),
      recurrence_end_date: null, // Definir como null
    },
  });

  const isRecurring = watch('is_recurring');
  const recurrenceDays = watch('recurrence_days_of_week');
  const selectedStudentId = watch('student_id');

  const { data: students, isLoading: isLoadingStudents } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
  });

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const defaultStartTime = format(now, "yyyy-MM-dd'T'HH:mm");
      const defaultEndTime = format(new Date(now.getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"); // 1 hour later

      reset({
        student_id: initialStudentId || null,
        title: '',
        start_time: defaultStartTime,
        end_time: defaultEndTime,
        notes: '',
        is_recurring: false,
        recurrence_days_of_week: [],
        recurrence_start_date: format(now, 'yyyy-MM-dd'),
        recurrence_end_date: null,
      });
      if (initialStudentId && students) {
        const student = students.find(s => s.id === initialStudentId);
        if (student) {
          setValue('title', `Aula com ${student.name}`);
        }
      }
    }
  }, [isOpen, initialStudentId, students, reset, setValue]);

  const mutation = useMutation({
    mutationFn: async (formData: ClassFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const classTitle = formData.student_id
        ? students?.find(s => s.id === formData.student_id)?.name || 'Aula com Aluno'
        : formData.title;

      if (formData.is_recurring) {
        const dataToSubmit = {
          user_id: user.id,
          title: classTitle,
          start_time_of_day: format(parseISO(formData.start_time), 'HH:mm:ss'), // Apenas a hora
          end_time_of_day: format(parseISO(formData.end_time), 'HH:mm:ss'), // Apenas a hora
          notes: formData.notes,
          recurrence_days_of_week: formData.recurrence_days_of_week,
          recurrence_start_date: formData.recurrence_start_date,
          recurrence_end_date: formData.recurrence_end_date || null,
        };
        const { error } = await supabase.from('recurring_class_templates').insert([dataToSubmit]);
        if (error) throw error;
      } else {
        // Converter para UTC antes de enviar ao Supabase
        const startUtc = zonedTimeToUtc(parseISO(formData.start_time), Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
        const endUtc = zonedTimeToUtc(parseISO(formData.end_time), Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();

        const dataToSubmit = {
          user_id: user.id,
          title: classTitle,
          start_time: startUtc,
          end_time: endUtc,
          notes: formData.notes,
          student_id: formData.student_id || null,
        };
        const { error } = await supabase.from('classes').insert([dataToSubmit]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['recurringClassTemplates'] });
      showSuccess(`Aula ${isRecurring ? 'recorrente agendada' : 'agendada'} com sucesso!`);
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const onSubmit = (data: ClassFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Nova Aula</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="student_id">Aluno (Opcional)</Label>
              <Controller
                name="student_id"
                control={control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={isLoadingStudents}
                      >
                        {field.value
                          ? students?.find((student) => student.id === field.value)?.name
                          : "Selecione um aluno..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar aluno..." />
                        <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                        <CommandGroup>
                          {students?.map((student) => (
                            <CommandItem
                              value={student.name}
                              key={student.id}
                              onSelect={() => {
                                field.onChange(student.id);
                                setValue('title', `Aula com ${student.name}`);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  student.id === field.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {student.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.student_id && <p className="text-sm text-destructive mt-1">{errors.student_id.message}</p>}
            </div>

            {!selectedStudentId && (
              <div className="space-y-2">
                <Label htmlFor="title">Título da Aula (Obrigatório se nenhum aluno for selecionado)</Label>
                <Controller name="title" control={control} render={({ field }) => <Input id="title" {...field} />} />
                {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Controller
                name="is_recurring"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="is_recurring"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="is_recurring">Aula Recorrente</Label>
            </div>

            {isRecurring ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Hora de Início</Label>
                    <Controller name="start_time" control={control} render={({ field }) => <Input id="start_time" type="time" {...field} />} />
                    {errors.start_time && <p className="text-sm text-destructive mt-1">{errors.start_time.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">Hora de Fim</Label>
                    <Controller name="end_time" control={control} render={({ field }) => <Input id="end_time" type="time" {...field} />} />
                    {errors.end_time && <p className="text-sm text-destructive mt-1">{errors.end_time.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map(day => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={recurrenceDays?.includes(day.value)}
                          onCheckedChange={(checked) => {
                            const currentDays = recurrenceDays || [];
                            if (checked) {
                              setValue('recurrence_days_of_week', [...currentDays, day.value]);
                            } else {
                              setValue('recurrence_days_of_week', currentDays.filter(d => d !== day.value));
                            }
                          }}
                        />
                        <Label htmlFor={`day-${day.value}`}>{day.label}</Label>
                      </div>
                    ))}
                  </div>
                  {errors.recurrence_days_of_week && <p className="text-sm text-destructive mt-1">{errors.recurrence_days_of_week.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recurrence_start_date">Data de Início da Recorrência</Label>
                    <Controller name="recurrence_start_date" control={control} render={({ field }) => <Input id="recurrence_start_date" type="date" {...field} />} />
                    {errors.recurrence_start_date && <p className="text-sm text-destructive mt-1">{errors.recurrence_start_date.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurrence_end_date">Data de Fim da Recorrência (Opcional)</Label>
                    <Controller name="recurrence_end_date" control={control} render={({ field }) => <Input id="recurrence_end_date" type="date" {...field} />} />
                    {errors.recurrence_end_date && <p className="text-sm text-destructive mt-1">{errors.recurrence_end_date.message}</p>}
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Início</Label>
                  <Controller name="start_time" control={control} render={({ field }) => <Input id="start_time" type="datetime-local" {...field} />} />
                  {errors.start_time && <p className="text-sm text-destructive mt-1">{errors.start_time.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Fim</Label>
                  <Controller name="end_time" control={control} render={({ field }) => <Input id="end_time" type="datetime-local" {...field} />} />
                  {errors.end_time && <p className="text-sm text-destructive mt-1">{errors.end_time.message}</p>}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas (Opcional)</Label>
              <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" {...field} />} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClassDialog;