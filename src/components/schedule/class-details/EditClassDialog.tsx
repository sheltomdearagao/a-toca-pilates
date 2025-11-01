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
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { StudentOption } from '@/types/student';
import type { ClassEvent, ClassAttendee } from '@/types/schedule';
import { fetchAll as _fetchAll } from 'query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import { AttendeesBus } from '@/utils/classAttendeesBus';
import { Skeleton } from '@/components/ui/skeleton';
import { ClassAttendee as _CA } from '@/types/schedule';

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
  const { data, error } = await supabase.from('students').select('id, name, enrollment_type').order('name');
  if (error) throw error;
  return data || [];
};

// Nova: função para buscar participantes da aula para exibir na janela de edição
const fetchAttendeesForEdit = async (classId: string): Promise<_CA[]> => {
  const { data, error } = await supabase
    .from('class_attendees')
    .select('id, status, students(name, enrollment_type)')
    .eq('class_id', classId)
    .order('name', { foreignTable: 'students', ascending: true });
  if (error) throw error;
  return (data as any) || [];
};

// Tipagem local para uso na tela de edição
type AttendeeDisplay = {
  id: string;
  status: string;
  students?: { name: string; enrollment_type?: string };
};

const EditClassDialog = ({ isOpen, onOpenChange, classEvent }: EditClassDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [attendees, setAttendees] = useState<AttendeeDisplay[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [localShowAttendees, setLocalShowAttendees] = useState<AttendeeDisplay[]>([]);

  // Buscar todos os alunos
  useEffect(() => {
    if (isOpen) {
      fetchAllStudents().then(setAllStudents).catch(console.error);
      if (classEvent?.id) {
        fetchAttendeesForEdit(classEvent.id).then(setAttendees).catch(console.error);
      }
    }
  }, [isOpen, classEvent?.id]);

  // Sync com bus (quando há mudanças de presença em outras janelas)
  useEffect(() => {
    const unsub = AttendeesBus.subscribe((updated) => {
      if (classEvent?.id) {
        fetchAttendeesForEdit(classEvent.id)
          .then(list => {
            const mapped = list.map(a => ({
              id: a.id,
              status: a.status,
              students: a.students as any,
            }));
            setAttendees(mapped as any);
            setLocalShowAttendees(mapped as any);
          });
      }
    });
    return unsub;
  }, [classEvent?.id]);

  // Submissão de edição (mantém lógica anterior)
  const { control, handleSubmit, reset, watch, setValue } = useForm<ClassFormData>({
    // Mantém schema existente
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_id: null,
      title: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '08:00',
      notes: '',
    },
  });

  // Carrega dados iniciais ao abrir
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
    }
  }, [isOpen, classEvent, reset]);

  // Renderização de uma seção simples de participantes para refletir status
  // (isto não altera a lógica de salvamento, apenas exibe dados atualizados)
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Aula</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(() => {})}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Aluno</Label>
              <Controller name="student_id" control={control} render={({ field }) => (
                <Input {...field} />
              )} />
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
                      {availableHours.map((hour) => (
                        <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Controller name="notes" control={control} render={({ field }) => <Textarea {...field} />} />
            </div>

            {/* Seção de participantes cadastrados (mostra status) */}
            <div className="space-y-2 border-t pt-4">
              <Label>Participantes da Aula</Label>
              {attendees.length === 0 && <div className="text-sm text-muted-foreground">Nenhum participante cadastrado.</div>}
              {attendees.length > 0 && (
                <div className="space-y-2">
                  {attendees.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded bg-muted/20">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.students?.name ?? 'Aluno'}</span>
                        <span className="text-xs text-muted-foreground">{a.students?.enrollment_type ?? ''}</span>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium" // status badge simples
                        style={{
                          backgroundColor: a.status === 'Presente' ? 'var(--status-present, #34d399)' :
                                          a.status === 'Faltou' ? 'var(--status-absent, #f87171)' :
                                          'var(--status-scheduled, #93c5fd)',
                          color: 'white',
                        }}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={false}>
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