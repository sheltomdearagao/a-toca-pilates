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

const availableHours = Array.from({ length: 14 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});

const classSchema = z.object({
  student_ids: z.array(z.string()).min(1).max(10),
  title: z.string().optional(),
  is_experimental: z.boolean().default(false),
  date: z.string().min(1),
  time: z.string().regex(/^\d{2}:00$/),
  is_recurring_4_weeks: z.boolean().default(false),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.is_experimental && data.student_ids.length > 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Experimentais só para 1 aluno.', path: ['student_ids'] });
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
  const { data: students = [], isLoading: isLoadingStudents } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
  });

  const { control, handleSubmit, reset, watch, setValue } = useForm<ClassFormData>({
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

  const selectedIds = watch('student_ids');
  const isPopOpenDefault = false;
  const [isPopOpen, setIsPopOpen] = useState<boolean>(isPopOpenDefault);

  useEffect(() => {
    if (isOpen) {
      reset({
        student_ids: preSelectedStudentId ? [preSelectedStudentId] : [],
        title: '',
        is_experimental: false,
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

      const baseDate = parseISO(formData.date);
      const [hh] = formData.time.split(':');
      const numWeeks = formData.is_recurring_4_weeks ? 4 : 1;
      let classesCreatedCount = 0;

      for (let i = 0; i < numWeeks; i++) {
        const classDate = addWeeks(baseDate, i);
        const localDateTime = set(classDate, { hours: +hh, minutes: 0 });
        
        // Converte a data/hora local para UTC (Supabase armazena em TIMESTAMPTZ)
        const startUtc = fromZonedTime(localDateTime, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
        
        const classTitle = formData.title || `Aula (${formData.student_ids.length} alunos)`;
        
        // 1. Insere a aula
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
        if (!newClass) throw new Error("Falha ao criar a aula.");

        // 2. Insere os participantes
        const attendees = formData.student_ids.map(sid => ({
          user_id: user.id,
          class_id: newClass.id,
          student_id: sid,
          status: 'Agendado',
        }));
        
        const { error: attendeesError } = await supabase.from('class_attendees').insert(attendees);
        if (attendeesError) throw attendeesError;
        
        classesCreatedCount++;
      }
      return classesCreatedCount;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      showSuccess(`Agendadas ${c} aula(s).`);
      onOpenChange(false);
    },
    onError: (err: any) => showError(err.message),
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
                    <button type="button" className="ml-1" onClick={() => setValue('student_ids', selectedIds.filter(x => x !== selectedIds[i]))}>×</button>
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

            {mutation.isError && <p className="text-red-600 text-sm">{(mutation.error as any)?.message}</p>}

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
              <Controller name="is_experimental" control={control} render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              )} />
              <Label>Aula Experimental</Label>
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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 w-4 h-4 animate-spin" />} Agendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClassDialog;