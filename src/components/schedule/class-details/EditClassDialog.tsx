import React, { useState, useEffect } from 'react';
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
import { Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { format, set, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { StudentOption } from '@/types/student';
import type { ClassEvent, AttendanceType } from '@/types/schedule';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import { consumeRepositionCredit, returnRepositionCredit } from '@/utils/repositionCreditManager'; // Importar utilitários

const availableHours = Array.from({ length: 14 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});

const ATTENDANCE_TYPES: AttendanceType[] = ['Pontual', 'Experimental', 'Reposicao', 'Recorrente'];

const classSchema = z.object({
  student_id: z.string().nullable(),
  title: z.string().min(3, 'O título é obrigatório.'),
  attendance_type: z.enum(['Pontual', 'Experimental', 'Reposicao', 'Recorrente']).default('Pontual'), // Adicionado tipo de presença
  date: z.string().min(1, 'A data é obrigatória.'),
  time: z.string().regex(/^\d{2}:00$/, 'O horário deve ser em hora cheia (ex: 08:00).'),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.attendance_type === 'Reposicao' && data.student_id === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Aulas de Reposição exigem um aluno selecionado.', path: ['student_id'] });
  }
  // Se não houver aluno, o título deve ser validado
  if (data.student_id === null && (!data.title || data.title.trim().length < 3)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'O título é obrigatório se nenhum aluno for selecionado.', path: ['title'] });
  }
});

type ClassFormData = z.infer<typeof classSchema>;

interface EditClassDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classEvent: ClassEvent | null;
}

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, enrollment_type')
    .order('name');
  if (error) throw error;
  return data || [];
};

const fetchOriginalAttendee = async (classId: string) => {
  const { data, error } = await supabase
    .from('class_attendees')
    .select('student_id, attendance_type')
    .eq('class_id', classId)
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // Ignora 'nenhum resultado'
  return data;
};

const EditClassDialog = ({ isOpen, onOpenChange, classEvent }: EditClassDialogProps) => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const [localSelectedStudentId, setLocalSelectedStudentId] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch, setValue } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_id: null,
      title: '',
      attendance_type: 'Pontual',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '08:00',
      notes: '',
    },
  });

  const selectedAttendanceType = watch('attendance_type');
  const selectedStudentId = watch('student_id');

  // Buscar todos os alunos ao abrir o diálogo
  useEffect(() => {
    if (isOpen) {
      fetchAllStudents().then(setAllStudents).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && classEvent) {
      const startTime = parseISO(classEvent.start_time);
      const studentId = classEvent.student_id || null;
      
      // Tenta buscar o tipo de presença original (se houver)
      fetchOriginalAttendee(classEvent.id).then(originalAttendee => {
        const originalType = originalAttendee?.attendance_type || 'Pontual';
        
        reset({
          student_id: studentId,
          title: classEvent.title || '',
          attendance_type: originalType as AttendanceType,
          date: format(startTime, 'yyyy-MM-dd'),
          time: format(startTime, 'HH:00'),
          notes: classEvent.notes || '',
        });
        setLocalSelectedStudentId(studentId);
      }).catch(err => {
        console.error("Erro ao carregar tipo de presença original:", err);
        reset({
          student_id: studentId,
          title: classEvent.title || '',
          attendance_type: 'Pontual', // Fallback
          date: format(startTime, 'yyyy-MM-dd'),
          time: format(startTime, 'HH:00'),
          notes: classEvent.notes || '',
        });
        setLocalSelectedStudentId(studentId);
      });
    }
  }, [isOpen, classEvent, reset]);

  const onSubmit = async (data: ClassFormData) => {
    if (!classEvent?.id) {
      showError('ID da aula não encontrado para edição.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // 1. Lógica de Devolução/Consumo de Crédito
      const originalAttendee = await fetchOriginalAttendee(classEvent.id);
      const originalStudentId = originalAttendee?.student_id;
      const originalAttendanceType = originalAttendee?.attendance_type;
      
      const newStudentId = data.student_id;
      const newAttendanceType = data.attendance_type;

      // A. Devolver crédito se o aluno original era Reposição e foi removido/alterado
      if (originalStudentId && originalAttendanceType === 'Reposicao' && originalStudentId !== newStudentId) {
        await returnRepositionCredit(originalStudentId);
      }
      
      // B. Consumir crédito se o novo aluno for Reposição e for diferente do original (ou se o tipo mudou para Reposição)
      if (newStudentId && newAttendanceType === 'Reposicao' && (newStudentId !== originalStudentId || originalAttendanceType !== 'Reposicao')) {
        // O consumeRepositionCredit já valida o saldo e lança erro se for insuficiente
        await consumeRepositionCredit(newStudentId);
      }

      // 2. Construir novo start_time a partir de data/hora local
      const [year, month, day] = data.date.split('-').map(Number);
      const [hh] = data.time.split(':').map(Number);
      
      const localDate = set(new Date(year, month - 1, day), { hours: hh, minutes: 0, seconds: 0, milliseconds: 0 });
      const startUtc = fromZonedTime(localDate, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();

      // 3. Atualizar aula
      const { error: updateError } = await supabase.from('classes').update({
        title: data.title || null,
        start_time: startUtc,
        duration_minutes: 60,
        notes: data.notes || null,
        student_id: newStudentId, // Atualiza o student_id na tabela classes
      }).eq('id', classEvent.id);
      
      if (updateError) throw updateError;

      // 4. Atualizar participantes:
      // Remove todos os participantes existentes para esta aula
      await supabase.from('class_attendees').delete().eq('class_id', classEvent.id);
      
      // Adiciona o novo participante, se houver
      if (newStudentId) {
        const { error: insertAttendeeError } = await supabase.from('class_attendees').insert([
          {
            user_id: user.id,
            class_id: classEvent.id,
            student_id: newStudentId,
            status: 'Agendado',
            attendance_type: newAttendanceType, // Usa o novo tipo de presença
          },
        ]);
        if (insertAttendeeError) throw insertAttendeeError;
      }

      // Invalida queries para atualizar a agenda, detalhes da aula e créditos
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent.id] });
      queryClient.invalidateQueries({ queryKey: ['repositionCredits'] });
      
      showSuccess('Aula atualizada com sucesso! Créditos ajustados.');
      onOpenChange(false);
    } catch (err: any) {
      showError(err?.message || 'Erro ao editar aula.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Aula</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Aluno</Label>
              <Controller
                name="student_id"
                control={control}
                render={({ field }) => (
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {localSelectedStudentId
                          ? allStudents.find(s => s.id === localSelectedStudentId)?.name || 'Selecionar aluno...'
                          : 'Selecionar aluno...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar aluno..." />
                        <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                        <CommandGroup>
                          {allStudents.map((student) => (
                            <CommandItem
                              key={student.id}
                              value={student.name}
                              onSelect={() => {
                                const newId = student.id;
                                field.onChange(newId);
                                setLocalSelectedStudentId(newId);
                                // Preenche o título automaticamente se um aluno for selecionado
                                setValue('title', `Aula com ${student.name}`);
                                setIsPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  student.id === localSelectedStudentId ? "opacity-100" : "opacity-0"
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
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Controller
                name="title"
                control={control}
                render={({ field }) => <Input {...field} />}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Tipo de Agendamento</Label>
              <Controller
                name="attendance_type"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {selectedAttendanceType === 'Reposicao' && !selectedStudentId && (
                <p className="text-xs text-destructive">Aulas de Reposição exigem um aluno selecionado.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => <Input type="date" {...field} />}
                />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Controller
                  name="time"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableHours.map((hour) => (
                          <SelectItem key={hour} value={hour}>
                            {hour}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => <Textarea {...field} />}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditClassDialog;