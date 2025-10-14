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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parse, set } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { StudentOption } from '@/types/student';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const classSchema = z.object({
  student_id: z.string().optional().nullable(),
  title: z.string().min(3, 'O título é obrigatório.').optional(),
  date: z.string().min(1, 'A data é obrigatória.'),
  time: z.string().min(1, 'O horário é obrigatório.'),
  notes: z.string().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_days_of_week: z.array(z.string()).optional(),
  recurrence_start_date: z.string().optional(),
  recurrence_end_date: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.is_recurring) {
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

// Dias da semana sem domingo
const daysOfWeek = [
  { label: 'Seg', value: 'monday' },
  { label: 'Ter', value: 'tuesday' },
  { label: 'Qua', value: 'wednesday' },
  { label: 'Qui', value: 'thursday' },
  { label: 'Sex', value: 'friday' },
  { label: 'Sáb', value: 'saturday' },
];

// Horários disponíveis (6h às 21h)
const availableHours = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 6;
  return {
    value: `${hour.toString().padStart(2, '0')}:00`,
    label: `${hour.toString().padStart(2, '0')}:00`,
  };
});

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, enrollment_type')
    .order('name');
  
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
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '08:00',
      notes: '',
      is_recurring: false,
      recurrence_days_of_week: [],
      recurrence_start_date: format(new Date(), 'yyyy-MM-dd'),
      recurrence_end_date: null,
    },
  });

  const isRecurring = watch('is_recurring');
  const recurrenceDays = watch('recurrence_days_of_week');
  const selectedStudentId = watch('student_id');

  const { data: students, isLoading: isLoadingStudents } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        student_id: initialStudentId || null,
        title: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '08:00',
        notes: '',
        is_recurring: false,
        recurrence_days_of_week: [],
        recurrence_start_date: format(new Date(), 'yyyy-MM-dd'),
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
          start_time_of_day: `${formData.time}:00`,
          duration_minutes: 60,
          notes: formData.notes,
          recurrence_days_of_week: formData.recurrence_days_of_week,
          recurrence_start_date: formData.recurrence_start_date,
          recurrence_end_date: formData.recurrence_end_date || null,
        };
        const { error } = await supabase.from('recurring_class_templates').insert([dataToSubmit]);
        if (error) throw error;
      } else {
        // Criar datetime combinando data e hora
        const [hours, minutes] = formData.time.split(':');
        const dateTime = set(new Date(formData.date), {
          hours: parseInt(hours),
          minutes: parseInt(minutes),
          seconds: 0,
          milliseconds: 0,
        });
        
        const startUtc = fromZonedTime(dateTime, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
        
        const dataToSubmit = {
          user_id: user.id,
          title: classTitle,
          start_time: startUtc,
          duration_minutes: 60,
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
                <Label htmlFor="title">Título da Aula</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="time">Horário</Label>
                  <Controller
                    name="time"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o horário..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableHours.map(hour => (
                            <SelectItem key={hour.value} value={hour.value}>
                              {hour.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.time && <p className="text-sm text-destructive mt-1">{errors.time.message}</p>}
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
                    <Label htmlFor="recurrence_start_date">Data de Início</Label>
                    <Controller name="recurrence_start_date" control={control} render={({ field }) => <Input id="recurrence_start_date" type="date" {...field} />} />
                    {errors.recurrence_start_date && <p className="text-sm text-destructive mt-1">{errors.recurrence_start_date.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurrence_end_date">Data de Fim (Opcional)</Label>
                    <Controller name="recurrence_end_date" control={control} render={({ field }) => <Input id="recurrence_end_date" type="date" {...field} />} />
                    {errors.recurrence_end_date && <p className="text-sm text-destructive mt-1">{errors.recurrence_end_date.message}</p>}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="date">Data</Label>
                  <Controller name="date" control={control} render={({ field }) => <Input id="date" type="date" {...field} />} />
                  {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Horário</Label>
                  <Controller
                    name="time"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o horário..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableHours.map(hour => (
                            <SelectItem key={hour.value} value={hour.value}>
                              {hour.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.time && <p className="text-sm text-destructive mt-1">{errors.time.message}</p>}
                </div>
              </>
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