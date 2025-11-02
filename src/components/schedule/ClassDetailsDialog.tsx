import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Check, X, Trash2, Edit, UserPlus, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { ClassEvent, ClassAttendee, AttendanceStatus, AttendanceType } from '@/types/schedule';
import { StudentOption, EnrollmentType } from '@/types/student'; // Importar EnrollmentType
import { showError, showSuccess } from '@/utils/toast';
import EditClassDialog from './class-details/EditClassDialog';
import DeleteClassDialog from './class-details/DeleteClassDialog';
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

const ATTENDANCE_TYPES: AttendanceType[] = ['Pontual', 'Experimental', 'Reposicao', 'Recorrente'];

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, enrollment_type')
    .order('name');

  if (error) throw new Error(error.message);
  return data || [];
};

const fetchClassAttendees = async (classId: string): Promise<ClassAttendee[]> => {
  const { data, error } = await supabase
    .from('class_attendees')
    .select(
      `
        id,
        user_id,
        class_id,
        student_id,
        status,
        attendance_type,
        students(name, enrollment_type)
      `,
    )
    .eq('class_id', classId)
    .order('name', { foreignTable: 'students', ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const attendee = row as unknown as {
      id: string;
      user_id?: string;
      class_id?: string;
      student_id?: string | null;
      status?: AttendanceStatus;
      attendance_type?: AttendanceType;
      students?: Array<{
        name?: string;
        enrollment_type?: string;
      }> | null;
    };

    // Extrai o primeiro (e esperado único) objeto do array 'students'
    const studentRecord = attendee.students?.[0];

    return {
      id: attendee.id,
      user_id: attendee.user_id,
      class_id: attendee.class_id,
      student_id: attendee.student_id ?? undefined,
      status: attendee.status ?? 'Agendado',
      attendance_type: attendee.attendance_type ?? 'Pontual',
      students: studentRecord
        ? {
            name: studentRecord.name ?? 'Aluno',
            // Afirma que a string do banco é um EnrollmentType válido
            enrollment_type: studentRecord.enrollment_type as EnrollmentType, 
          }
        : undefined,
    } satisfies ClassAttendee;
  });
};

const ClassDetailsDialog = ({ isOpen, onOpenChange, classEvent, classCapacity }: ClassDetailsDialogProps) => {
  const queryClient = useQueryClient();
  const [attendees, setAttendees] = useState<ClassAttendee[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedAttendanceType, setSelectedAttendanceType] = useState<AttendanceType>('Pontual');
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    enabled: isOpen,
    staleTime: 1000 * 60 * 5,
  });

  const loadAttendees = useCallback(async () => {
    if (!classEvent?.id) {
      setAttendees([]);
      return;
    }
    setIsLoadingAttendees(true);
    try {
      const data = await fetchClassAttendees(classEvent.id);
      setAttendees(data);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsLoadingAttendees(false);
    }
  }, [classEvent?.id]);

  useEffect(() => {
    if (isOpen) {
      void loadAttendees();
    } else {
      setAttendees([]);
    }
  }, [isOpen, loadAttendees]);

  const refreshData = useCallback(async () => {
    await loadAttendees();
    queryClient.invalidateQueries({ queryKey: ['classes'] });
  }, [loadAttendees, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: AttendanceStatus }) => {
      const { error } = await supabase
        .from('class_attendees')
        .update({ status })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshData();
      showSuccess('Status da presença atualizado com sucesso!');
    },
    onError: (error) => showError(error.message),
  });

  const removeAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase.from('class_attendees').delete().eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshData();
      showSuccess('Participante removido com sucesso!');
    },
    onError: (error) => showError(error.message),
  });

  const addAttendeeMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!classEvent?.id) throw new Error('Aula não encontrada.');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const { error } = await supabase.from('class_attendees').insert({
        user_id: user.id,
        class_id: classEvent.id,
        student_id: studentId,
        status: 'Agendado',
        attendance_type: selectedAttendanceType,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshData();
      setSelectedStudentId('');
      setIsAddingAttendee(false);
      showSuccess('Participante adicionado com sucesso!');
    },
    onError: (error) => {
      setIsAddingAttendee(false);
      showError(error.message);
    },
  });

  const handleUpdateStatus = (attendeeId: string, status: AttendanceStatus) => {
    updateStatusMutation.mutate({ attendeeId, status });
  };

  const handleRemoveAttendee = (attendeeId: string) => {
    removeAttendeeMutation.mutate(attendeeId);
  };

  const handleAddAttendee = () => {
    if (!selectedStudentId) {
      showError('Selecione um aluno para adicionar.');
      return;
    }

    setIsAddingAttendee(true);
    addAttendeeMutation.mutate(selectedStudentId);
  };

  const handleDeleteSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    onOpenChange(false);
  };

  const availableStudents = useMemo(
    () =>
      students.filter((student) => !attendees.some((attendee) => attendee.student_id === student.id)),
    [students, attendees],
  );

  const isClassFull = attendees.length >= classCapacity;

  if (!classEvent) {
    return null;
  }

  const startTime = parseISO(classEvent.start_time);
  const formattedDate = format(startTime, "eeee, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Aula</DialogTitle>
            <DialogDescription>{formattedDate} ({classEvent.duration_minutes} min)</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Título</span>
                <span>{classEvent.title}</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsEditOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar Aula
                </Button>
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir Aula
                </Button>
              </div>
            </div>

            {classEvent.notes && (
              <div className="space-y-2">
                <h4 className="font-semibold">Notas</h4>
                <p className="text-sm text-muted-foreground">{classEvent.notes}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center font-semibold">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Adicionar Participante ({attendees.length}/{classCapacity})
                </h4>
                <Badge variant={isClassFull ? 'destructive' : 'secondary'}>
                  {isClassFull ? 'Lotada' : `${classCapacity - attendees.length} vagas`}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={selectedStudentId}
                  onValueChange={setSelectedStudentId}
                  disabled={isLoadingStudents}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um aluno..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingStudents ? (
                      <SelectItem value="loading" disabled>
                        Carregando...
                      </SelectItem>
                    ) : availableStudents.length > 0 ? (
                      availableStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name} ({student.enrollment_type})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Nenhum aluno disponível
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedAttendanceType}
                  onValueChange={(value: AttendanceType) => setSelectedAttendanceType(value)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTENDANCE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={handleAddAttendee} disabled={!selectedStudentId || isAddingAttendee}>
                  {isAddingAttendee ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Adicionar
                </Button>
              </div>

              {isClassFull && (
                <p className="text-sm text-muted-foreground">
                  A aula atingiu a capacidade máxima, mas você ainda pode adicionar alunos se necessário.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center font-semibold">
                  <Users className="mr-2 h-4 w-4" />
                  Participantes ({attendees.length}/{classCapacity})
                </h4>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Presente
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Faltou
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Agendado
                  </div>
                </div>
              </div>

              {isLoadingAttendees ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : attendees.length === 0 ? (
                <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
                  Nenhum participante nesta aula até o momento.
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between rounded-lg border bg-secondary/20 p-3 transition-all hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{attendee.students?.name}</span>
                        {attendee.students?.enrollment_type && (
                          <Badge variant="outline">{attendee.students.enrollment_type}</Badge>
                        )}
                        {attendee.attendance_type && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {attendee.attendance_type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            attendee.status === 'Presente'
                              ? 'attendance-present'
                              : attendee.status === 'Faltou'
                                ? 'attendance-absent'
                                : 'attendance-scheduled'
                          }
                        >
                          {attendee.status}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(attendee.id, 'Presente')}
                          title="Marcar como Presente"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(attendee.id, 'Faltou')}
                          title="Marcar como Faltou"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveAttendee(attendee.id)}
                          title="Remover Participante"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {classEvent && (
        <EditClassDialog
          isOpen={isEditOpen}
          onOpenChange={setIsEditOpen}
          classEvent={classEvent}
        />
      )}

      {classEvent && (
        <DeleteClassDialog
          isOpen={isDeleteOpen}
          onOpenChange={setDeleteOpen}
          classId={classEvent.id}
          classTitle={classEvent.title}
          onDeleted={handleDeleteSuccess}
        />
      )}
    </>
  );
};

export default ClassDetailsDialog;