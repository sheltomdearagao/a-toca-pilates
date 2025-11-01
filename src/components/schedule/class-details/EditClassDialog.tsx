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
import type { ClassEvent } from '@/types/schedule';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import { useQueryClient } from '@tanstack/react-query'; // Importar useQueryClient

const availableHours = Array.from({ length: 14 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});

const classSchema = z.object({
  student_id: z.string().nullable(),
  title: z.string().min(3, 'O título é obrigatório.'),
  date: z.string().min(1, 'A data é obrigatória.'),
  time: z.string().regex(/^\d{2}:00$/, 'O horário deve ser em hora cheia (ex: 08:00).'),
  notes: z.string().optional(),
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

const EditClassDialog = ({ isOpen, onOpenChange, classEvent }: EditClassDialogProps) => {
  const queryClient = useQueryClient(); // Usar queryClient
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // Usamos o estado local para o ID selecionado para facilitar a exibição no botão
  const [localSelectedStudentId, setLocalSelectedStudentId] = useState<string | null>(null);

  // Buscar todos os alunos ao abrir o diálogo
  useEffect(() => {
    if (isOpen) {
      fetchAllStudents().then(setAllStudents).catch(console.error);
    }
  }, [isOpen]);

  const { control, handleSubmit, reset, watch, setValue } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_id: null,
      title: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '08:00',
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen && classEvent) {
      const startTime = parseISO(classEvent.start_time);
      const studentId = classEvent.student_id || null;
      
      reset({
        student_id: studentId,
        title: classEvent.title || '',
        date: format(startTime, 'yyyy-MM-dd'),
        time: format(startTime, 'HH:00'), // Forçando para hora cheia
        notes: classEvent.notes || '',
      });
      setLocalSelectedStudentId(studentId);
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

      // 1. Construir novo start_time a partir de data/hora local
      const [year, month, day] = data.date.split('-').map(Number);
      const [hh] = data.time.split(':').map(Number);
      
      // Cria a data local
      const localDate = set(new Date(year, month - 1, day), { hours: hh, minutes: 0, seconds: 0, milliseconds: 0 });
      
      // Converte a data/hora local para UTC (TIMESTAMPTZ)
      const startUtc = fromZonedTime(localDate, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();

      // 2. Atualizar aula
      const { error: updateError } = await supabase.from('classes').update({
        title: data.title || null,
        start_time: startUtc,
        duration_minutes: 60,
        notes: data.notes || null,
        student_id: data.student_id || null,
      }).eq('id', classEvent.id);
      
      if (updateError) throw updateError;

      // 3. Atualizar participantes:
      // Se o aluno mudou ou foi removido, precisamos garantir que o class_attendees reflita isso.
      
      // Remove todos os participantes existentes para esta aula
      await supabase.from('class_attendees').delete().eq('class_id', classEvent.id);
      
      // Adiciona o novo participante, se houver
      if (data.student_id) {
        const { error: insertAttendeeError } = await supabase.from('class_attendees').insert([
          {
            user_id: user.id,
            class_id: classEvent.id,
            student_id: data.student_id,
            status: 'Agendado',
          },
        ]);
        if (insertAttendeeError) throw insertAttendeeError;
      }

      // Invalida queries para atualizar a agenda e os detalhes da aula
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent.id] });
      
      showSuccess('Aula atualizada com sucesso!');
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
                              value={student.name} // Usar o nome para busca
                              onSelect={() => {
                                const newId = student.id;
                                field.onChange(newId);
                                setLocalSelectedStudentId(newId);
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