import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, ChevronsUpDown, AlertTriangle } from 'lucide-react'; // Importando AlertTriangle
import { showError, showSuccess } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
import { StudentOption } from '@/types/student';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { RecurringClassTemplate, RecurrencePatternItem } from '@/types/schedule';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Importando Alert

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Segunda-feira' },
  { value: 'tuesday', label: 'Terça-feira' },
  { value: 'wednesday', label: 'Quarta-feira' },
  { value: 'thursday', label: 'Quinta-feira' },
  { value: 'friday', label: 'Sexta-feira' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

const availableHours = Array.from({ length: 14 }, (_, i) => {
  const hour = i + 7; // 7h às 20h
  return `${hour.toString().padStart(2, '0')}:00`;
});

const recurringClassSchema = z.object({
  student_id: z.string().optional().nullable(),
  title: z.string().min(3, "O título é obrigatório.").optional(),
  recurrence_start_date: z.string().min(1, "A data de início é obrigatória."),
  recurrence_end_date: z.string().optional().nullable(),
  selected_days: z.array(z.string()).min(1, "Selecione pelo menos um dia da semana."),
  times_per_day: z.record(z.string(), z.string().regex(/^\d{2}:00$/, 'O horário deve ser em hora cheia (ex: 08:00).')),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.student_id && (!data.title || data.title.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O título da aula é obrigatório se nenhum aluno for selecionado.',
      path: ['title'],
    });
  }
  data.selected_days.forEach(day => {
    if (!data.times_per_day[day]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Selecione um horário para ${DAYS_OF_WEEK.find(d => d.value === day)?.label}.`,
        path: [`times_per_day.${day}`],
      });
    }
  });
});

type RecurringClassFormData = z.infer<typeof recurringClassSchema>;

interface EditRecurringClassTemplateDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  template: RecurringClassTemplate | null;
}

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, enrollment_type')
    .order('name');
  
  if (error) throw new Error(error.message);
  return data || [];
};

const EditRecurringClassTemplateDialog = ({ isOpen, onOpenChange, template }: EditRecurringClassTemplateDialogProps) => {
  const queryClient = useQueryClient();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false); // Estado para controlar o popover
  
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<RecurringClassFormData>({
    resolver: zodResolver(recurringClassSchema),
    defaultValues: {
      student_id: null,
      title: '',
      recurrence_start_date: format(new Date(), 'yyyy-MM-dd'),
      recurrence_end_date: '',
      selected_days: [],
      times_per_day: {},
      notes: '',
    },
  });

  const selectedStudentId = watch('student_id');
  const selectedDays = watch('selected_days');
  const timesPerDay = watch('times_per_day');

  const { data: students, isLoading: isLoadingStudents } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isOpen && template) {
      const initialTimes: Record<string, string> = {};
      const initialDays: string[] = [];

      template.recurrence_pattern.forEach(p => {
        initialDays.push(p.day);
        initialTimes[p.day] = p.time;
      });

      reset({
        student_id: template.student_id || null,
        title: template.title || '',
        recurrence_start_date: template.recurrence_start_date,
        recurrence_end_date: template.recurrence_end_date || '',
        selected_days: initialDays,
        times_per_day: initialTimes,
        notes: template.notes || '',
      });
    } else if (!isOpen) {
      // Opcional: resetar ao fechar, mas manteremos o estado para reabrir rápido
    }
  }, [isOpen, template, reset]);

  const mutation = useMutation({
    mutationFn: async (formData: RecurringClassFormData) => {
      if (!template?.id) throw new Error('ID do modelo não encontrado para atualização.');

      const classTitle = formData.student_id
        ? students?.find(s => s.id === formData.student_id)?.name || 'Aula Recorrente'
        : formData.title!;

      const recurrence_pattern: RecurrencePatternItem[] = formData.selected_days.map(day => ({
        day,
        time: formData.times_per_day[day],
      }));

      const templateData = {
        student_id: formData.student_id || null,
        title: classTitle,
        duration_minutes: 60, // Duração fixa em 60 minutos
        notes: formData.notes || null,
        recurrence_pattern: recurrence_pattern,
        recurrence_start_date: formData.recurrence_start_date,
        recurrence_end_date: formData.recurrence_end_date || null,
      };

      // 1. Atualiza o modelo
      const { error: templateError } = await supabase
        .from('recurring_class_templates')
        .update(templateData)
        .eq('id', template.id);

      if (templateError) throw templateError;

      // 2. Chama a função RPC para regenerar as aulas futuras
      const { error: rpcError } = await supabase.rpc('generate_classes_from_template', {
        template_id: template.id,
      });

      if (rpcError) throw rpcError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['recurringClassTemplates'] });
      showSuccess('Modelo de aula recorrente atualizado e agenda regenerada com sucesso!');
      onOpenChange(false);
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const onSubmit = (data: RecurringClassFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Recorrência: {template?.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <Alert variant="default" className="bg-yellow-50/50 border-yellow-300 text-yellow-800">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle>Atenção!</AlertTitle>
              <AlertDescription>
                Salvar alterações irá **remover e regenerar todas as aulas futuras** (a partir de hoje) associadas a este modelo.
              </AlertDescription>
            </Alert>

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

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="recurrence_start_date">Data de Início</Label>
                <Controller name="recurrence_start_date" control={control} render={({ field }) => <Input id="recurrence_start_date" type="date" {...field} />} />
                {errors.recurrence_start_date && <p className="text-sm text-destructive mt-1">{errors.recurrence_start_date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Duração</Label>
                <Input value="60 min" disabled className="font-semibold text-primary" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="recurrence_end_date">Data de Término (Opcional)</Label>
              <Controller name="recurrence_end_date" control={control} render={({ field }) => <Input id="recurrence_end_date" type="date" {...field} value={field.value || ''} />} />
              {errors.recurrence_end_date && <p className="text-sm text-destructive mt-1">{errors.recurrence_end_date.message}</p>}
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
                          checked={field.value.includes(day.value)}
                          onCheckedChange={(checked) => {
                            const newSelectedDays = checked
                              ? [...field.value, day.value]
                              : field.value.filter((value) => value !== day.value);
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
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditRecurringClassTemplateDialog;