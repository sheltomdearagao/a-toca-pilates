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
import { format, set, parseISO, addDays } from 'date-fns';
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
  student_id: z.string().optional().nullable(),
  title: z.string().min(3, 'O título é obrigatório.').optional(),
  is_experimental: z.boolean().default(false),
  date: z.string().min(1, 'A data de início é obrigatória.'),
  
  // Campos para agendamento de múltiplas aulas
  selected_days: z.array(z.string()).optional(),
  times_per_day: z.record(z.string(), z.string().regex(/^\d{2}:00$/, 'O horário deve ser em hora cheia (ex: 08:00).')).optional(),
  
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  // 1. Validação de Título/Aluno
  if (!data.student_id && (!data.title || data.title.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O título da aula é obrigatório se nenhum aluno for selecionado.',
      path: ['title'],
    });
  }
  
  // 2. Validação de Dias/Horários
  const selectedDays = data.selected_days || [];
  if (selectedDays.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selecione pelo menos um dia e horário para agendar a aula.',
      path: ['selected_days'],
    });
  }

  // 3. Validação de Aula Experimental
  if (data.is_experimental && selectedDays.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Aulas experimentais só podem ser agendadas para um único dia.',
      path: ['is_experimental'],
    });
  }

  // 4. Validação de Horário por Dia
  selectedDays.forEach(day => {
    if (!data.times_per_day?.[day]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Selecione um horário para ${DAYS_OF_WEEK.find(d => d.value === day)?.label}.`,
        path: [`times_per_day.${day}`],
      });
    }
  });
});

type ClassFormData = z.infer<typeof classSchema>;

interface AddClassDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  quickAddSlot?: { date: Date; hour: number } | null;
  preSelectedStudentId?: string; // Novo prop
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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_id: null,
      title: '',
      is_experimental: false,
      date: format(new Date(), 'yyyy-MM-dd'),
      selected_days: [],
      times_per_day: {},
      notes: '',
    },
  });

  const selectedStudentId = watch('student_id');
  const isExperimental = watch('is_experimental');
  const selectedDays = watch('selected_days') || [];
  const timesPerDay = watch('times_per_day') || {};

  const { data: students, isLoading: isLoadingStudents } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isOpen) {
      let initialStudentId = preSelectedStudentId || null;
      let initialTitle = '';

      if (initialStudentId) {
        const student = students?.find(s => s.id === initialStudentId);
        if (student) {
          initialTitle = `Aula com ${student.name}`;
        }
      }

      if (quickAddSlot) {
        const dayOfWeek = format(quickAddSlot.date, 'eeee').toLowerCase();
        const timeString = `${quickAddSlot.hour.toString().padStart(2, '0')}:00`;
        
        reset({
          student_id: initialStudentId,
          title: initialTitle,
          is_experimental: false,
          date: format(quickAddSlot.date, 'yyyy-MM-dd'),
          selected_days: [dayOfWeek],
          times_per_day: { [dayOfWeek]: timeString },
          notes: '',
        });
      } else {
        reset({
          student_id: initialStudentId,
          title: initialTitle,
          is_experimental: false,
          date: format(new Date(), 'yyyy-MM-dd'),
          selected_days: [],
          times_per_day: {},
          notes: '',
        });
      }
    }
  }, [isOpen, quickAddSlot, preSelectedStudentId, students, reset]);

  const mutation = useMutation({
    mutationFn: async (formData: ClassFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const classesToInsert = [];
      const startDate = parseISO(formData.date);

      for (const dayOfWeek of formData.selected_days || []) {
        const timeString = formData.times_per_day?.[dayOfWeek];
        if (!timeString) continue;

        // Encontra a data da próxima ocorrência do dia da semana a partir da data de início
        let currentDay = startDate;
        while (format(currentDay, 'eeee').toLowerCase() !== dayOfWeek) {
          currentDay = addDays(currentDay, 1);
        }
        
        // Se a aula for experimental, agendamos apenas a primeira ocorrência
        if (formData.is_experimental && format(currentDay, 'yyyy-MM-dd') !== formData.date) {
            // Se a data de início não for o dia da semana selecionado, pulamos (experimental só agenda 1)
            continue;
        }
        
        const classTitle = formData.student_id
          ? students?.find(s => s.id === formData.student_id)?.name || 'Aula'
          : formData.title!;

        const [hours, minutes] = timeString.split(':');
        const dateTime = set(currentDay, {
          hours: parseInt(hours),
          minutes: parseInt(minutes),
          seconds: 0,
          milliseconds: 0,
        });
        
        const startUtc = fromZonedTime(dateTime, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
        
        classesToInsert.push({
          user_id: user.id,
          title: classTitle,
          start_time: startUtc,
          duration_minutes: 60, // Duração fixa em 60 minutos
          notes: formData.notes || null,
          student_id: formData.student_id || null,
        });

        // Se for experimental, agendamos apenas uma aula e paramos
        if (formData.is_experimental) break;
      }

      if (classesToInsert.length === 0) {
        throw new Error("Nenhuma aula válida para agendamento encontrada.");
      }
      
      // Usamos a função RPC para criar a aula e o attendee
      const results = await Promise.all(classesToInsert.map(async (classData) => {
        const { error } = await supabase.rpc('create_class_with_attendee', {
          p_title: classData.title,
          p_start_time: classData.start_time,
          p_duration_minutes: classData.duration_minutes,
          p_notes: classData.notes || '',
          p_student_id: classData.student_id || null,
        });
        if (error) throw error;
      }));
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      const count = variables.selected_days?.length || 0;
      showSuccess(`${count} aula(s) agendada(s) com sucesso!`);
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Nova Aula (60 min)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="student_id">Aluno (Opcional)</Label>
              <Controller
                name="student_id"
                control={control}
                render={({ field }) => (
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={isLoadingStudents || !!preSelectedStudentId} // Desabilita se pré-selecionado
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
                                setIsPopoverOpen(false); // Fechar após seleção
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
            
            <div className="space-y-2">
              <Label htmlFor="date">Data de Início (Semana)</Label>
              <Controller name="date" control={control} render={({ field }) => <Input id="date" type="date" {...field} />} />
              {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
            </div>
            
            <div className="space-y-2 p-3 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Controller
                  name="is_experimental"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="is_experimental"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="is_experimental" className="font-semibold">Aula Experimental</Label>
              </div>
              {isExperimental && <p className="text-xs text-destructive">Apenas uma aula pode ser agendada por vez.</p>}
            </div>

            <div className="space-y-2">
              <Label>Dias da Semana e Horários (Hora Cheia)</Label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Controller
                      name="selected_days"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id={day.value}
                          checked={field.value?.includes(day.value)}
                          disabled={isExperimental && selectedDays.length >= 1 && !selectedDays.includes(day.value)}
                          onCheckedChange={(checked) => {
                            const newSelectedDays = checked
                              ? [...(field.value || []), day.value]
                              : (field.value || []).filter((value) => value !== day.value);
                            field.onChange(newSelectedDays);
                            if (!checked) {
                              const newTimesPerDay = { ...timesPerDay };
                              delete newTimesPerDay[day.value];
                              setValue('times_per_day', newTimesPerDay);
                            } else {
                              if (!timesPerDay[day.value]) {
                                setValue(`times_per_day.${day.value}`, availableHours[0]);
                              }
                            }
                          }}
                        />
                      )}
                    />
                    <Label htmlFor={day.value} className="flex-1">{day.label}</Label>
                    {selectedDays.includes(day.value) && (
                      <Controller
                        name={`times_per_day.${day.value}`}
                        control={control}
                        render={({ field, fieldState }) => {
                          return (
                            <div className="flex flex-col">
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="w-[100px]">
                                  <SelectValue placeholder="Hora" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableHours.map(hour => (<SelectItem key={hour} value={hour}>{hour}</SelectItem>))}
                                </SelectContent>
                              </Select>
                              {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                            </div>
                          );
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
              {errors.selected_days && <p className="text-sm text-destructive mt-1">{errors.selected_days.message}</p>}
            </div>
            
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
              Agendar Aula(s)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClassDialog;