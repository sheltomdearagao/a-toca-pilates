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
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronsUpDown, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { StudentOption } from '@/types/student';
import type { ClassEvent } from '@/types/schedule';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

// Local AttendeeDisplay type for this dialog
type AttendeeDisplay = {
  id: string;
  status: string;
  students?: { name: string; enrollment_type?: string };
};

// Map API attendee to local AttendeeDisplay type
const mapToAttendeeDisplay = (att: any): AttendeeDisplay => ({
  id: att.id,
  status: att.status ?? 'Agendado',
  students: att.students ? { name: att.students.name, enrollment_type: att.students.enrollment_type } : undefined,
});

// API fetch to obtain attendees for editing (then map in caller)
const fetchAttendeesForEdit = async (classId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('class_attendees')
    .select('id, status, student_id, students(id, name, enrollment_type)')
    .eq('class_id', classId)
    .order('name', { foreignTable: 'students', ascending: true });
  if (error) throw error;
  return data ?? [];
};

// Fetch all students for picker
const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase.from('students').select('id, name, enrollment_type').order('name');
  if (error) throw error;
  return data ?? [];
};

// Validation schema
const classSchema = z.object({
  student_id: z.string().nullable(),
  title: z.string().min(3, 'O título é obrigatório.'),
  date: z.string().min(1, 'A data é obrigatória.'),
  time: z.string().regex(/^\d{2}:00$/, 'O horário deve ser em hora cheia (ex: 08:00).'),
  notes: z.string().optional(),
});

type ClassFormData = z.infer<typeof classSchema>;

export default function EditClassDialog({ isOpen, onOpenChange, classEvent }: { isOpen: boolean; onOpenChange: (b: boolean)=>void; classEvent: ClassEvent | null; }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [attendees, setAttendees] = useState<AttendeeDisplay[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [localSelectedStudentId, setLocalSelectedStudentId] = useState<string | null>(null);

  // Load students when opening
  useEffect(() => {
    if (isOpen) {
      fetchAllStudents().then(setAllStudents).catch(console.error);
    }
  }, [isOpen]);

  // Load attendees and map to AttendeeDisplay
  useEffect(() => {
    const loadAttendees = async () => {
      if (classEvent?.id) {
        try {
          const raw = await fetchAttendeesForEdit(classEvent.id);
          const mapped = raw.map((a) => mapToAttendeeDisplay(a));
          setAttendees(mapped);
        } catch (err) {
          console.error(err);
          showError('Falha ao carregar participantes.');
        }
      }
    };
    if (isOpen) loadAttendees();
  }, [isOpen, classEvent?.id]);

  const { control, handleSubmit, reset } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_id: null,
      title: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '08:00',
      notes: '',
    },
  });

  // Pre-fill data when editing
  useEffect(() => {
    if (isOpen && classEvent) {
      const startTime = parseISO(classEvent.start_time);
      reset({
        student_id: classEvent.student_id ?? null,
        title: classEvent.title ?? '',
        date: format(startTime, 'yyyy-MM-dd'),
        time: format(startTime, 'HH:mm'),
        notes: classEvent.notes ?? '',
      });
      setLocalSelectedStudentId(classEvent.student_id ?? null);
    }
  }, [isOpen, classEvent, reset]);

  // Save handler placeholder
  const onSubmit = async (_data: ClassFormData) => {
    if (!classEvent?.id) {
      showError('ID da aula não encontrado para edição.');
      return;
    }
    showSuccess('Salvar não implementado neste fix de compile-time.');
  };

  // Render
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
              <Controller name="student_id" control={control} render={({ field }) => (
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      {localSelectedStudentId
                        ? (allStudents.find(s => s.id === localSelectedStudentId)?.name ?? '')
                        : 'Selecionar aluno...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4" />
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
                              setIsPopoverOpen(false);
                            }}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            {student.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              )} />
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Controller name="title" control={control} render={({ field }) => <Input {...field} />} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Controller name="date" control={control} render={({ field }) => <Input type="date" {...field} />} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Controller name="time" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 14 }, (_, i) => {
                        const hour = i + 7;
                        const v = `${hour.toString().padStart(2, '0')}:00`;
                        return <SelectItem key={v} value={v}>{v}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Controller name="notes" control={control} render={({ field }) => <textarea {...field} />} />
            </div>

            {/* Participantes atuais */}
            <div className="space-y-2 border-t pt-4">
              <Label>Participantes da Aula</Label>
              {attendees.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum participante cadastrado.</div>
              ) : (
                attendees.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.students?.name ?? 'Aluno'}</span>
                      <span className="text-xs text-muted-foreground">{a.students?.enrollment_type ?? ''}</span>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: '#e5e7eb' }}>
                      {a.status}
                    </span>
                  </div>
                ))
              )}
            </div>

          </div>

          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={false}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}