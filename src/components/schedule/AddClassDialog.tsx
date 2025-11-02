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
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, set, parseISO, addWeeks } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { StudentOption } from '@/types/student';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { AttendanceType } from '@/types/schedule';
import { useRepositionCredits } from '@/hooks/useRepositionCredits';

const availableHours = Array.from({ length: 14 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});

const ATTENDANCE_TYPES: AttendanceType[] = ['Pontual', 'Experimental', 'Reposicao', 'Recorrente'];

const classSchema = z.object({
  student_ids: z.array(z.string()).min(1).max(10),
  title: z.string().optional(),
  attendance_type: z.enum(['Pontual', 'Experimental', 'Reposicao', 'Recorrente']).default('Pontual'),
  date: z.string().min(1),
  time: z.string().regex(/^\d{2}:00$/),
  is_recurring_4_weeks: z.boolean().default(false),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.attendance_type === 'Experimental' && data.student_ids.length > 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Aulas Experimentais só podem ser agendadas para 1 aluno.', path: ['student_ids'] });
  }
  if (data.attendance_type === 'Reposicao' && data.student_ids.length !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Aulas de Reposição devem ser agendadas para 1 aluno por vez.', path: ['student_ids'] });
  }
});

type ClassFormData = z.infer<typeof classSchema>;

interface AddClassDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  quickAddSlot?: { date: Date; hour: number } | null;
  preSelectedStudentId?: string | null;
}

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase.from('students').select('id, name, enrollment_type').order('name');
  if (error) throw error;
  return data || [];
};

const AddClassDialog = ({ isOpen, onOpenChange, quickAddSlot, preSelectedStudentId }: AddClassDialogProps) => {
  const qc = useQueryClient();
  const { data: students = [] } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
  });

  const { control, handleSubmit, reset, watch, setValue } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_ids: preSelectedStudentId ? [preSelectedStudentId] : [],
      title: '',
      attendance_type: 'Pontual',
      date: quickAddSlot ? format(quickAddSlot.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      time: quickAddSlot ? `${quickAddSlot.hour.toString().padStart(2, '0')}:00` : availableHours[0],
      is_recurring_4_weeks: false,
      notes: '',
    },
  });

  const selectedIds = watch('student_ids');
  const selectedAttendanceType = watch('attendance_type');

  const selectedStudentForRepos = selectedAttendanceType === 'Reposicao' && selectedIds.length === 1 ? selectedIds[0] : undefined;
  const { credits, isLoading: isLoadingCredits, consumeCredit } = useRepositionCredits(selectedStudentForRepos);

  const [isPopOpen, setIsPopOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      reset({
        student_ids: preSelectedStudentId ? [preSelectedStudentId] : [],
        title: '',
        attendance_type: 'Pontual',
        date: quickAddSlot ? format(quickAddSlot.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        time: quickAddSlot ? `${quickAddSlot.hour.toString().padStart(2, '0')}:00` : availableHours[0],
        is_recurring_4_weeks: false,
        notes: '',
      });
    }
  }, [isOpen, quickAddSlot, preSelectedStudentId, reset]);

  const mutation = useMutation({
    mutationFn: async (formData: ClassFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado.");

      const numWeeks = formData.is_recurring_4_weeks ? 4 : 1;
      const requiredCredits = formData.attendance_type === 'Reposicao' ? numWeeks : 0;

      // 1. Validação e Consumo de Crédito (Apenas para Reposição)
      if (formData.attendance_type === 'Reposicao') {
        if (requiredCredits > 0) {
          // O hook useRepositionCredits já tem a lógica de validação de saldo.
          // Chamamos a mutação de consumo de crédito para cada aula a ser agendada.
          for (let i = 0; i < numWeeks; i++) {
            // Usamos mutateAsync para garantir que o débito ocorra antes de prosseguir
            await consumeCredit.mutateAsync();
          }
        }
      }

      // 2. Criação das Aulas
      let classesCreatedCount = 0;

      for (let i = 0; i < numWeeks; i++) {
        const baseDate = parseISO(formData.date);
        const [hh] = formData.time.split(':');
        
        const classDate = addWeeks(baseDate, i);
        const localDateTime = set(classDate, { hours: +hh, minutes: 0, seconds: 0, milliseconds: 0 });
        const startUtc = fromZonedTime(localDateTime, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
        const classTitle = formData.title || `Aula (${formData.student_ids.length} alunos)`;

        const { data: newClass, error: classError } = await supabase
          .from('classes')
          .insert({
            user_id: user.id,
            title: classTitle,
            start_time: startUtc,
            duration_minutes: 60,
            notes: formData.notes || null,
            student_id: formData.student_ids.length === 1 ? formData.student_ids[0] : null,
          })
          .select('id')
          .single();
        if (classError) throw classError;
        if (!newClass) throw new Error('Falha ao criar a aula.');

        const attendees = formData.student_ids.map((sid) => ({
          user_id: user.id,
          class_id: newClass.id,
          student_id: sid,
          status: 'Agendado',
          attendance_type: formData.attendance_type,
        }));
        const { error: attendeesError } = await supabase.from('class_attendees').insert(attendees);
        if (attendeesError) throw attendeesError;

        classesCreatedCount++;
      }

      return classesCreatedCount;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      if (selectedStudentForRepos) {
        // Invalida o saldo de créditos para refletir o consumo
        qc.invalidateQueries({ queryKey: ['repositionCredits', selectedStudentForRepos] });
      }
      showSuccess(`Agendadas ${c} aula(s).`);
      onOpenChange(false);
    },
    onError: (err: any) => {
      // Se o erro veio da mutação de consumo de crédito, ele será tratado aqui.
      showError(err.message);
    },
  });

  const onSubmit = (d: ClassFormData) => mutation.mutate(d);

  const chips = useMemo(
    () =>
      selectedIds.map(id => {
        const s = students.find(x => x.id === id);
        return s ? `${s.name} (${s.enrollment_type[0]})` : id;
      }),
    [students, selectedIds]
  );

  const requiredCredits = watch('is_recurring_4_weeks') ? 4 : 1;
  const isCreditCheckFailed = selectedAttendanceType === 'Reposicao' && !isLoadingCredits && credits < requiredCredits;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Agendar Aula</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Alunos (max 10)</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {chips.map((c, i) => (
                  <span key={i} className="px-2 py-1 bg-muted/50 rounded-full text-xs flex items-center">
                    {c}
                    <button
                      type="button"
                      className="ml-1"
                      onClick={() => setValue('student_ids', selectedIds.filter(x => x !== selectedIds[i]))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <Controller
              name="student_ids"
              control={control}
              render={({ field }) => (
                <Popover open={isPopOpen} onOpenChange={setIsPopOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full">
                      {field.value.length ? `${field.value.length} selecionado(s)` : 'Adicionar alunos...'}
                      <ChevronsUpDown className="ml-2 w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar..." />
                      <CommandEmpty>Nenhum</CommandEmpty>
                      <CommandGroup className="max-h-40 overflow-y-auto">
                        {students.map(s => {
                          const sel = field.value.includes(s.id);
                          const dis = !sel && field.value.length >= 10;
                          return (
                            <CommandItem
                              key={s.id}
                              disabled={dis}
                              onSelect={() => {
                                field.onChange(sel
                                  ? field.value.filter(x => x !== s.id)
                                  : [...field.value, s.id]
                                );
                              }}
                            >
                              <Check className={`mr-2 ${sel ? '' : 'opacity-0'}`} />
                              {s.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            />

            <div className="space-y-2">
              <Label>Tipo de Agendamento</Label>
              <Controller
                name="attendance_type"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(value: AttendanceType) => {
                      field.onChange(value);
                      // Força 1 aluno para Experimental/Reposição
                      if ((value === 'Experimental' || value === 'Reposicao') && selectedIds.length > 1) {
                        setValue('student_ids', selectedIds.slice(0, 1));
                      }
                    }}
                    value={field.value}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {selectedAttendanceType === 'Experimental' && (
                <p className="text-xs text-destructive">Aulas Experimentais são limitadas a 1 aluno.</p>
              )}
              {selectedAttendanceType === 'Reposicao' && selectedStudentForRepos && (
                <p className={cn("text-xs", isCreditCheckFailed ? "text-destructive" : "text-muted-foreground")}>
                  Créditos disponíveis: {isLoadingCredits ? '...' : credits} {watch('is_recurring_4_weeks') ? `(necessários: 4)` : `(necessários: 1)`}
                </p>
              )}
            </div>

            {mutation.isError && <p className="text-red-600 text-sm">{(mutation.error as any)?.message}</p>}
            {isCreditCheckFailed && <p className="text-red-600 text-sm">Créditos insuficientes para agendar esta reposição.</p>}

            <div className="grid grid-cols-2 gap-4">
              <Controller name="date" control={control} render={({ field }) => (
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" {...field} />
                </div>
              )} />
              <Controller name="time" control={control} render={({ field }) => (
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <Input {...field} />
                </div>
              )} />
            </div>

            <div className="flex items-center space-x-2">
              <Controller name="is_recurring_4_weeks" control={control} render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              )} />
              <Label>Recorrência 4 Semanas</Label>
            </div>

            <div>
              <Label>Notas</Label>
              <Controller name="notes" control={control} render={({ field }) => (
                <Input {...field} />
              )} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={mutation.isPending || isCreditCheckFailed}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Agendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClassDialog;