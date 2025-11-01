import React, { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { AttendeesBus } from '@/utils/classAttendeesBus';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Check, X, Trash2, Edit, UserPlus, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { ClassEvent, ClassAttendee, AttendanceStatus } from '@/types/schedule';
import { StudentOption } from '@/types/student';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import EditClassDialog from './class-details/EditClassDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClassDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classEvent: ClassEvent | null;
  classCapacity: number;
}

const fetchClassAttendees = async (classId: string): Promise<ClassAttendee[]> => {
  const { data, error } = await supabase
    .from('class_attendees')
    .select(`id, status, students(name, enrollment_type)`)
    .eq('class_id', classId)
    .order('name', { foreignTable: 'students', ascending: true });

  if (error) throw new Error(error.message);
  return (data as any[] || []);
};

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase.from('students').select('id, name, enrollment_type').order('name');
  if (error) throw error;
  return data || [];
};

const ClassDetailsDialog = ({ isOpen, onOpenChange, classEvent, classCapacity }: ClassDetailsDialogProps) => {
  const queryClient = useQueryClient();
  const [attendees, setAttendees] = useState<ClassAttendee[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<string>('');
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);

  // Dados de alunos
  const { data: allStudents, isLoading: isLoadingAllStudents } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
    enabled: isOpen,
  });

  // Sincronização com bus para presença
  useEffect(() => {
    const unsub = AttendeesBus.subscribe((updated) => {
      if (classEvent?.id) {
        fetchClassAttendees(classEvent.id).then((list) => {
          setAttendees(list);
          AttendeesBus.emit(list);
        });
      }
    });
    return () => unsub();
  }, [classEvent?.id]);

  useEffect(() => {
    if (isOpen && classEvent?.id) {
      setIsLoadingAttendees(true);
      fetchClassAttendees(classEvent.id)
        .then((data) => {
          setAttendees(data);
          AttendeesBus.emit(data);
        })
        .catch((error) => {
          showError(error.message);
        })
        .finally(() => {
          setIsLoadingAttendees(false);
        });
    } else {
      setAttendees([]);
      AttendeesBus.emit([]);
    }
  }, [isOpen, classEvent?.id]);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: AttendanceStatus }) => {
      const { error } = await supabase
        .from('class_attendees')
        .update({ status })
        .eq('id', attendeeId);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      setAttendees((prev) =>
        prev.map((a) => (a.id === vars.attendeeId ? { ...a, status: vars.status } as any : a))
      );
      const next = attendees.map((a) => (a.id === vars.attendeeId ? { ...a, status: vars.status } : a));
      AttendeesBus.emit(next as any);
      return { prevAttendees: attendees };
    },
    onError: (error, vars, context) => {
      if (context?.prevAttendees) {
        setAttendees(context.prevAttendees as any);
        AttendeesBus.emit(context.prevAttendees as any);
      }
      showError(error.message);
    },
    onSuccess: (_data, vars) => {
      if (classEvent?.id) {
        fetchClassAttendees(classEvent.id).then((list) => {
          setAttendees(list);
          AttendeesBus.emit(list);
          queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent.id] });
        });
      }
    },
  });

  const removeAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase.from('class_attendees').delete().eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (classEvent?.id) {
        fetchClassAttendees(classEvent.id).then((list) => {
          setAttendees(list);
          AttendeesBus.emit(list);
          queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent.id] });
          queryClient.invalidateQueries({ queryKey: ['classes'] });
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['classes'] });
      }
      showSuccess('Participante removido com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const addAttendeeMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!classEvent?.id) throw new Error("ID da aula não encontrado.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { error } = await supabase.from('class_attendees').insert({
        user_id: user.id,
        class_id: classEvent.id,
        student_id: studentId,
        status: 'Agendado',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (classEvent?.id) {
        fetchClassAttendees(classEvent.id).then((list) => {
          setAttendees(list);
          AttendeesBus.emit(list);
          queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent.id] });
        });
      }
      setSelectedStudentToAdd('');
      showSuccess('Participante adicionado com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleUpdateStatus = useCallback((attendeeId: string, status: AttendanceStatus) => {
    updateStatusMutation.mutate({ attendeeId, status });
  }, [updateStatusMutation]);

  const handleRemoveAttendee = useCallback((attendeeId: string) => {
    removeAttendeeMutation.mutate(attendeeId);
  }, [removeAttendeeMutation]);

  const handleAddAttendee = useCallback(() => {
    if (!selectedStudentToAdd) {
      showError("Selecione um aluno para adicionar.");
      return;
    }
    // Otimista: adiciona na lista
    const studentObj = allStudents?.find(s => s.id === selectedStudentToAdd);
    const optimistic: any = {
      id: `temp_${Date.now()}`,
      user_id: null,
      class_id: classEvent?.id,
      student_id: selectedStudentToAdd,
      status: 'Agendado',
      students: { name: studentObj?.name, enrollment_type: studentObj?.enrollment_type },
    };

    setAttendees(prev => [...prev, optimistic]);
    const idToAdd = selectedStudentToAdd;
    setSelectedStudentToAdd('');
    setIsAddingAttendee(true);

    addAttendeeMutation.mutate(idToAdd, {
      onSuccess: () => {
        setIsAddingAttendee(false);
      },
      onError: (err) => {
        // Reverter otimista
        setAttendees(prev => prev.filter(a => a.id !== optimistic.id));
        setIsAddingAttendee(false);
        showError(err?.message || 'Erro ao adicionar participante.');
      }
    });
  }, [selectedStudentToAdd, allStudents, classEvent?.id, addAttendeeMutation, setAttendees]);

  // Estado local de seleção de aluno para adicionar
  const [selectedStudentToAddLocal, setSelectedStudentToAddLocal] = useState<string>('');
  // ... restante da renderização permanece igual, incluindo UI de lista de Attendees e botões de Ação …

  // Retorno da renderização
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Aula</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Título</span>
              <span>{classEvent?.title}</span>
            </div>
            <Button onClick={() => setIsEditOpen(true)}>
              <Edit className="w-4 h-4 mr-2" /> Editar Aula
            </Button>
          </div>
          {/* Seção de participação atualizada com mutação otimista já aplicada */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center justify-between">
              <div className="flex items-center">
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Participante ({attendees.length}/{classCapacity})
              </div>
              <Badge variant={attendees.length >= classCapacity ? "destructive" : "secondary"}>
                {attendees.length >= classCapacity ? 'Lotada' : `${classCapacity - attendees.length} vagas`}
              </Badge>
            </h4>
            <div className="flex gap-2 items-center">
              <Select value={selectedStudentToAdd} onValueChange={(v) => setSelectedStudentToAdd(v)}>
                <SelectTrigger><SelectValue placeholder="Selecione um aluno..." /></SelectTrigger>
                <SelectContent>
                  {isLoadingAllStudents ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : availableStudentsToAdd.length > 0 ? (
                    availableStudentsToAdd.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.enrollment_type})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>Nenhum aluno disponível</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button onClick={handleAddAttendee} disabled={!selectedStudentToAdd || isAddingAttendee} size="sm">
                {isAddingAttendee ? <Loader2 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />} Adicionar
              </Button>
            </div>
            {classEvent && attendees.length >= classCapacity && (
              <p className="text-sm text-destructive">Aula está Lotada. A adição de novos alunos não alterará a contagem exibida.</p>
            )}
          </div>

          {/* Lista de Participantes atualizada */}
          <div className="space-y-2 border-t pt-4">
            <Label>Participantes</Label>
            {attendees.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum participante.</div>
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
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>

        <EditClassDialog isOpen={isEditOpen} onOpenChange={setIsEditOpen} classEvent={classEvent} />
      </DialogContent>
    </Dialog>
  );
};

export default ClassDetailsDialog;