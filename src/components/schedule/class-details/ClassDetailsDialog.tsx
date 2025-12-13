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
import { StudentOption, EnrollmentType } from '@/types/student';
import { showError, showSuccess } from '@/utils/toast';
import EditClassDialog from './EditClassDialog';
import DeleteClassDialog from './DeleteClassDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useRepositionCredits } from '@/hooks/useRepositionCredits';
import AddAttendeeSection from './AddAttendeeSection'; // Fixed import

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
        students(id, name, enrollment_type)
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
      students?: { id?: string; name?: string; enrollment_type?: string } | Array<{ id?: string; name?: string; enrollment_type?: string }> | null;
    };

    // Garantir objeto único (Supabase pode retornar objeto diretamente no 1:1)
    const studentRecord = Array.isArray(attendee.students) ? attendee.students[0] : attendee.students;

    return {
      id: attendee.id,
      user_id: attendee.user_id,
      class_id: attendee.class_id,
      student_id: attendee.student_id ?? undefined,
      status: attendee.status ?? 'Agendado',
      attendance_type: attendee.attendance_type ?? 'Pontual',
      students: studentRecord
        ? {
            id: studentRecord.id,
            name: studentRecord.name ?? 'Aluno',
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
  const [isDisplaceConfirmationOpen, setIsDisplaceConfirmationOpen] = useState(false);
  const [studentToDisplace, setStudentToDisplace] = useState<ClassAttendee | null>(null);
  const [newStudentForDisplacement, setNewStudentForDisplacement] = useState<StudentOption | null>(null);

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    enabled: isOpen,
    staleTime: 1000 * 60 * 5,
  });

  const { credits, isLoading: isLoadingCredits } = useRepositionCredits(selectedStudentId);

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
    queryClient.invalidateQueries({ queryKey: ['studentStats'] }); // Invalida estatísticas de alunos
  }, [loadAttendees, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: AttendanceStatus }) => {
      const { error } = await supabase
        .from('class_attendees')
        .update({ status })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: async (_, { status, attendeeId }) => {
      await refreshData();
      // Atualizando os feedbacks de presença
      const attendee = attendees.find(a => a.id === attendeeId);
      if (attendee?.attendance_type === 'Reposicao' && status === 'Presente') {
        showSuccess('Presença confirmada. 1 Crédito de reposição consumido!');
      } else if (attendee?.attendance_type === 'Pontual' && status === 'Faltou') {
        showSuccess('Falta registrada. Crédito de reposição gerado!');
      } else {
        showSuccess(status === 'Presente' ? 'Presença confirmada.' : 'Falta registrada na reposição.');
      }
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

      if (!studentId || studentId.length < 36) {
        throw new Error('ID do aluno inválido.');
      }

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

  const handleConfirmDisplacement = () => {
    if (studentToDisplace && newStudentForDisplacement) {
      // Remove the student to displace
      removeAttendeeMutation.mutate(studentToDisplace.id);
      // Add the new student
      addAttendeeMutation.mutate(newStudentForDisplacement.id);
      // Reset state
      setStudentToDisplace(null);
      setNewStudentForDisplacement(null);
      setIsDisplaceConfirmationOpen(false);
    }
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
                <Button onClick={() => setIsEditOpen(true)} variant="outline">
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

            {/* Seção de Adicionar Participante */}
            <div className="space-y-3 border-t pt-4">
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

            {/* Seção de Participantes e Controle de Presença */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center font-semibold">
                  <Users className="mr-2 h-4 w-4" />
                  Controle de Presença
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
                        {attendee.students?.id ? (
                          <Link
                            to={`/alunos/${attendee.students.id}`}
                            className="font-medium hover:underline hover:text-primary"
                            title="Abrir perfil do aluno"
                          >
                            {attendee.students?.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{attendee.students?.name}</span>
                        )}
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
                        
                        {/* Botões de Ação de Presença */}
                        <Button
                          size="icon"
                          variant={attendee.status === 'Presente' ? 'default' : 'ghost'}
                          className={cn("h-8 w-8", attendee.status === 'Presente' ? "bg-green-600 hover:bg-green-700 text-white" : "hover:bg-green-100 text-green-600")}
                          onClick={() => handleUpdateStatus(attendee.id, 'Presente')}
                          title="Marcar como Presente"
                          disabled={updateStatusMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant={attendee.status === 'Faltou' ? 'default' : 'ghost'}
                          className={cn("h-8 w-8", attendee.status === 'Faltou' ? "bg-red-600 hover:bg-red-700 text-white" : "hover:bg-red-100 text-red-600")}
                          onClick={() => handleUpdateStatus(attendee.id, 'Faltou')}
                          title="Marcar como Faltou"
                          disabled={updateStatusMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveAttendee(attendee.id)}
                          title="Remover Participante"
                          disabled={removeAttendeeMutation.isPending}
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

      <AddAttendeeSection
        availableStudentsForAdd={availableStudents}
        isLoadingAllStudents={isLoadingStudents}
        isClassFull={isClassFull}
        onAddAttendee={handleAddAttendee}
        onConfirmDisplacement={handleConfirmDisplacement}
        isAddingAttendee={isAddingAttendee}
        isDisplaceConfirmationOpen={isDisplaceConfirmationOpen}
        onDisplaceConfirmationChange={setIsDisplaceConfirmationOpen}
        setStudentToDisplace={setStudentToDisplace}
        setNewStudentForDisplacement={setNewStudentForDisplacement}
        attendees={attendees}
        allStudents={students}
        credits={credits}
        isLoadingCredits={isLoadingCredits}
        selectedAttendanceType={selectedAttendanceType}
      />
    </>
  );
};

export default ClassDetailsDialog;