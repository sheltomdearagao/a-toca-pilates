import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Check, X, Trash2, Edit, UserPlus, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { ClassEvent, ClassAttendee, AttendanceStatus, AttendanceType } from '@/types/schedule'; // Importar AttendanceType
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

const ATTENDANCE_TYPES: AttendanceType[] = ['Pontual', 'Experimental', 'Reposicao'];

const fetchClassAttendees = async (classId: string): Promise<ClassAttendee[]> => {
  const { data, error } = await supabase
    .from('class_attendees')
    .select(`
      id,
      status,
      attendance_type,
      students(name, enrollment_type)
    `)
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
  const [selectedAttendanceType, setSelectedAttendanceType] = useState<AttendanceType>('Pontual'); // Novo estado para o tipo de agendamento
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);

  const { data: allStudents, isLoading: isLoadingAllStudents } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen && classEvent?.id) {
      setIsLoadingAttendees(true);
      fetchClassAttendees(classEvent.id)
        .then((data) => {
          setAttendees(data);
        })
        .catch((error) => {
          showError(error.message);
        })
        .finally(() => {
          setIsLoadingAttendees(false);
        });
    } else {
      setAttendees([]);
    }
  }, [isOpen, classEvent?.id]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: AttendanceStatus }) => {
      const { error } = await supabase
        .from('class_attendees')
        .update({ status })
        .eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent?.id] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Status da presença atualizado com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const removeAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase
        .from('class_attendees')
        .delete()
        .eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent?.id] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Participante removido com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const addAttendeeMutation = useMutation({
    mutationFn: async ({ studentId, attendanceType }: { studentId: string; attendanceType: AttendanceType }) => {
      if (!classEvent?.id) throw new Error("ID da aula não encontrado.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { error } = await supabase
        .from('class_attendees')
        .insert({
          user_id: user.id,
          class_id: classEvent.id,
          student_id: studentId,
          status: 'Agendado',
          attendance_type: attendanceType, // INSERINDO O NOVO CAMPO
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent?.id] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Participante adicionado com sucesso!');
      setSelectedStudentToAdd('');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  // Atualização OTIMISTA do status ao clicar (Presente/Faltou)
  const handleUpdateStatus = useCallback((attendeeId: string, status: AttendanceStatus) => {
    const previous = attendees;
    // Atualiza imediatamente na UI
    setAttendees(prev => prev.map(a => a.id === attendeeId ? { ...a, status } : a));

    updateStatusMutation.mutate(
      { attendeeId, status },
      {
        onError: () => {
          // Reverte em caso de erro
          setAttendees(previous);
          showError('Falha ao atualizar status.');
        }
      }
    );
  }, [attendees, updateStatusMutation]);

  // Remoção OTIMISTA do participante ao clicar (Excluir)
  const handleRemoveAttendee = useCallback((attendeeId: string) => {
    const previous = attendees;
    const attendeeToRemove = attendees.find(a => a.id === attendeeId);
    
    // Atualiza imediatamente na UI
    setAttendees(prev => prev.filter(a => a.id !== attendeeId));

    removeAttendeeMutation.mutate(
      attendeeId,
      {
        onError: () => {
          // Reverte em caso de erro
          if (attendeeToRemove) {
            setAttendees(prev => [...prev, attendeeToRemove].sort((a, b) => (a.students?.name || '').localeCompare(b.students?.name || '')));
          } else {
            setAttendees(previous);
          }
          showError('Falha ao remover participante.');
        }
      }
    );
  }, [attendees, removeAttendeeMutation]);

  const handleAddAttendee = useCallback(() => {
    if (!selectedStudentToAdd) {
      showError("Selecione um aluno para adicionar.");
      return;
    }

    const studentObj = allStudents?.find(s => s.id === selectedStudentToAdd);
    const optimistic: any = {
      id: `temp_${Date.now()}`,
      user_id: null,
      class_id: classEvent?.id,
      student_id: selectedStudentToAdd,
      status: 'Agendado',
      attendance_type: selectedAttendanceType, // Otimista: Novo campo
      students: { name: studentObj?.name, enrollment_type: studentObj?.enrollment_type },
    };

    setAttendees(prev => [...prev, optimistic].sort((a, b) => (a.students?.name || '').localeCompare(b.students?.name || '')));
    const idToAdd = selectedStudentToAdd;
    const typeToAdd = selectedAttendanceType;
    setSelectedStudentToAdd('');
    setIsAddingAttendee(true);

    addAttendeeMutation.mutate({ studentId: idToAdd, attendanceType: typeToAdd }, {
      onSuccess: () => {
        setIsAddingAttendee(false);
      },
      onError: (err) => {
        setAttendees(prev => prev.filter(a => a.id !== optimistic.id));
        setIsAddingAttendee(false);
        showError(err?.message || 'Erro ao adicionar participante.');
      }
    });
  }, [selectedStudentToAdd, selectedAttendanceType, allStudents, classEvent?.id, addAttendeeMutation, setAttendees]);

  if (!classEvent) return null;

  const startTime = parseISO(classEvent.start_time);
  const endTime = new Date(startTime.getTime() + classEvent.duration_minutes * 60000);

  const getStatusVariant = (status: AttendanceStatus) => {
    switch (status) {
      case 'Presente': return 'attendance-present';
      case 'Faltou': return 'attendance-absent';
      case 'Agendado': return 'attendance-scheduled';
      default: return 'secondary';
    }
  };

  const getEnrollmentCode = (enrollmentType?: string) => {
    switch (enrollmentType) {
      case 'Wellhub': return 'G';
      case 'TotalPass': return 'T';
      default: return 'P';
    }
  };

  const availableStudentsToAdd = allStudents?.filter(
    student => !attendees.some(attendee => attendee.student_id === student.id)
  ) || [];

  const isClassFull = attendees.length >= classCapacity;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Aula</DialogTitle>
          <DialogDescription>
            {format(startTime, "eeee, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })} ({classEvent.duration_minutes} min)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Título</span>
              <span>{classEvent.title}</span>
            </div>
            <Button onClick={() => setIsEditOpen(true)}>
              <Edit className="w-4 h-4 mr-2" /> Editar Aula
            </Button>
          </div>
          {classEvent.notes && (
            <div className="space-y-2">
              <h4 className="font-semibold">Notas</h4>
              <p className="text-sm text-muted-foreground">{classEvent.notes}</p>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center justify-between">
              <div className="flex items-center">
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Participante ({attendees.length}/{classCapacity})
              </div>
              <Badge variant={isClassFull ? "destructive" : "secondary"}>
                <span className="inline-flex items-center gap-1">
                  {isClassFull ? 'Lotada' : `${classCapacity - attendees.length} vagas`}
                </span>
              </Badge>
            </h4>
            <div className="flex gap-2 items-center">
              <Select
                value={selectedStudentToAdd}
                onValueChange={setSelectedStudentToAdd}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um aluno..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingAllStudents ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : availableStudentsToAdd.length > 0 ? (
                    availableStudentsToAdd.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} ({student.enrollment_type})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>Nenhum aluno disponível</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Select
                value={selectedAttendanceType}
                onValueChange={(value: AttendanceType) => setSelectedAttendanceType(value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddAttendee}
                disabled={!selectedStudentToAdd || isAddingAttendee}
                size="sm"
              >
                {isAddingAttendee ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Adicionar
              </Button>
            </div>
            {isClassFull && (
              <p className="text-sm text-destructive">Aula está com capacidade máxima. A adição de novos alunos não é considerada nessa contagem, mas você pode continuar adicionando.</p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center justify-between">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Participantes ({attendees.length}/{classCapacity})
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Presente
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Faltou
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Agendado
                </div>
              </div>
            </h4>
            {isLoadingAttendees ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {attendees.length > 0 ? (
                  attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20 transition-all hover:shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">{attendee.students?.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {getEnrollmentCode(attendee.students?.enrollment_type)}
                        </Badge>
                        {attendee.attendance_type && (
                          <Badge variant="secondary" className="ml-1 text-xs font-normal">
                            {attendee.attendance_type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getStatusVariant(attendee.status as AttendanceStatus)}>
                          {attendee.status}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleUpdateStatus(attendee.id, 'Presente')}
                          title="Marcar como Presente"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleUpdateStatus(attendee.id, 'Faltou')}
                          title="Marcar como Faltou"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleRemoveAttendee(attendee.id)}
                          title="Remover Participante"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum participante nesta aula.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
        <EditClassDialog isOpen={isEditOpen} onOpenChange={setIsEditOpen} classEvent={classEvent} />
      </DialogContent>
    </Dialog>
  );
};

export default ClassDetailsDialog;