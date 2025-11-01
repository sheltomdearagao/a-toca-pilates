import React, { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Check, X, Trash2, Edit, UserPlus } from 'lucide-react';
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
  onOpenChange: (isOpen: boolean) => void;
  classEvent: ClassEvent | null;
  classCapacity: number;
}

const fetchClassAttendees = async (classId: string): Promise<ClassAttendee[]> => {
  const { data, error } = await supabase
    .from('class_attendees')
    .select(`
      id,
      status,
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
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);

  // Buscar todos os alunos disponíveis
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
    mutationFn: async (studentId: string) => {
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
    setIsAddingAttendee(true);
    addAttendeeMutation.mutate(selectedStudentToAdd, {
      onSuccess: () => {
        setIsAddingAttendee(false);
      },
      onError: () => {
        setIsAddingAttendee(false);
      }
    });
  }, [selectedStudentToAdd, addAttendeeMutation]);

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

  // Filtrar alunos que já estão na aula
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

          {/* Seção para adicionar participantes */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center">
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Participante ({attendees.length}/{classCapacity})
            </h4>
            <div className="flex gap-2">
              <Select
                value={selectedStudentToAdd}
                onValueChange={setSelectedStudentToAdd}
                disabled={isClassFull || isLoadingAllStudents}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um aluno..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingAllStudents ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : availableStudentsToAdd.length > 0 ? (
                    availableStudentsToAdd.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>Nenhum aluno disponível</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddAttendee}
                disabled={!selectedStudentToAdd || isClassFull || isAddingAttendee}
              >
                {isAddingAttendee && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar
              </Button>
            </div>
            {isClassFull && (
              <p className="text-sm text-muted-foreground">Aula está com capacidade máxima.</p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Participantes ({attendees.length}/{classCapacity})
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
                      className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">{attendee.students?.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {getEnrollmentCode(attendee.students?.enrollment_type)}
                        </Badge>
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
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleUpdateStatus(attendee.id, 'Faltou')}
                          title="Marcar como Faltou"
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleRemoveAttendee(attendee.id)}
                          title="Remover Participante"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
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