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
import { Loader2, ChevronsUpDown } from 'lucide-react';
import { format, set, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { StudentOption } from '@/types/student';
import type { ClassEvent } from '@/types/schedule';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

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
      reset({
        student_id: classEvent.student_id || null,
        title: classEvent.title || '',
        date: format(startTime, 'yyyy-MM-dd'),
        time: format(startTime, 'HH:mm'),
        notes: classEvent.notes || '',
      });
      setSelectedStudentId(classEvent.student_id || null);
    }
  }, [isOpen, classEvent, reset]);

  const onSubmit = async (data: ClassFormData) => {
    if (!classEvent?.id) {
      throw new Error('ID da aula não encontrado para edição.');
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // Construir novo start_time a partir de data/hora
      const dateParts = data.date.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      const baseDate = new Date(year, month, day);
      const [hh] = data.time.split(':');
      const dt = new Date(baseDate);
      dt.setHours(parseInt(hh || '0', 10), 0, 0, 0);
      const startUtc = fromZonedTime(dt, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();

      // Atualizar aula
      await supabase.from('classes').update({
        title: data.title || null,
        start_time: startUtc,
        duration_minutes: 60,
        notes: data.notes || null,
        student_id: data.student_id || null,
      }).eq('id', classEvent.id);

      // Atualizar participantes (remover todos e adicionar o novo, se houver)
      await supabase.from('class_attendees').delete().eq('class_id', classEvent.id);
      if (data.student_id) {
        await supabase.from('class_attendees').insert([
          {
            user_id: user.id,
            class_id: classEvent.id,
            student_id: data.student_id,
            status: 'Agendado',
          },
        ]);
      }

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
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                  >
                    {selectedStudentId
                      ? allStudents.find(s => s.id === selectedStudentId)?.name || 'Selecionar aluno...'
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
                          value={student.id}
                          onSelect={(currentValue) => {
                            setSelectedStudentId(currentValue);
                            setValue('student_id', currentValue);
                            setIsPopoverOpen(false);
                          }}
                        >
                          {student.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
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