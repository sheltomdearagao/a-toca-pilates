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
  student_ids: z.array(z.string()).min(1, 'Selecione pelo menos um aluno.'),
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
            title: classItem.title,
            start_time: startUtc,
            duration_minutes: 60,
            notes: formData.notes || null,
            student_id: studentsToEnroll.length === 1 ? studentsToEnroll[0] : null, // Se for 1 aluno, vincula diretamente
          })
          .select('id')
          .single();

        if (classError) throw classError;
        if (!newClass) throw new Error("Falha ao criar a aula.");

        // Insere os participantes (attendees)
        const attendeesToInsert = studentsToEnroll.map(studentId => ({
          user_id: user.id,
          class_id: newClass.id,
          student_id: studentId,
          status: 'Agendado',
        }));

        const { error: attendeesError } = await supabase
          .from('class_attendees')
          .insert(attendeesToInsert);

        if (attendeesError) throw attendeesError;
        totalClassesCreated++;
      }
      
      return totalClassesCreated;
    },
    onSuccess: (totalClassesCreated) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess(`${totalClassesCreated} aula(s) agendada(s) com sucesso para ${selectedStudentIds.length} aluno(s)!`);
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
          <DialogTitle>Agendar Nova Aula (Até 10 Alunos)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            
            {/* Seleção de Múltiplos Alunos */}
            <div className="space-y-2">
              <Label htmlFor="student_ids">Alunos (Máx. 10)</Label>
              <Controller
                name="student_ids"
                control={control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          field.value.length === 0 && "text-muted-foreground"
                        )}
                        disabled={isLoadingStudents}
                      >
                        {field.value.length > 0
                          ? `${field.value.length} aluno(s) selecionado(s)`
                          : "Selecione os alunos..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar aluno..." />
                        <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                        <CommandGroup className="max-h-40 overflow-y-auto">
                          {students?.map((student) => {
                            const isSelected = field.value.includes(student.id);
                            const isDisabled = !isSelected && field.value.length >= 10;
                            
                            return (
                              <CommandItem
                                value={student.name}
                                key={student.id}
                                disabled={isDisabled}
                                onSelect={() => {
                                  const newSelection = isSelected
                                    ? field.value.filter(id => id !== student.id)
                                    : [...field.value, student.id];
                                  field.onChange(newSelection);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    isSelected ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {student.name} ({student.enrollment_type})
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.student_ids && <p className="text-sm text-destructive mt-1">{errors.student_ids.message}</p>}
            </div>

            {/* Título da Aula (Opcional, se for aula em grupo) */}
            {selectedStudentIds.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="title">Título da Aula (Opcional)</Label>
                <Controller name="title" control={control} render={({ field }) => <Input id="title" {...field} />} />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Controller name="date" control={control} render={({ field }) => <Input id="date" type="date" {...field} />} />
                {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Horário (Hora Cheia)</Label>
                <Controller
                  name="time"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Hora" /></SelectTrigger>
                      <SelectContent>
                        {availableHours.map(hour => (<SelectItem key={hour} value={hour}>{hour}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.time && <p className="text-sm text-destructive mt-1">{errors.time.message}</p>}
              </div>
            </div>
            
            {/* Opções de Agendamento */}
            <div className="space-y-3 p-3 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Controller
                  name="is_experimental"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="is_experimental"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) setValue('is_recurring_4_weeks', false);
                      }}
                      disabled={isRecurring}
                    />
                  )}
                />
                <Label htmlFor="is_experimental" className="font-semibold">Aula Experimental (Apenas 1 aluno)</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Controller
                  name="is_recurring_4_weeks"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="is_recurring_4_weeks"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) setValue('is_experimental', false);
                      }}
                      disabled={isExperimental}
                    />
                  )}
                />
                <Label htmlFor="is_recurring_4_weeks" className="font-semibold flex items-center">
                  <Repeat className="w-4 h-4 mr-1 text-primary" /> Agendamento Recorrente (4 Semanas)
                </Label>
              </div>
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