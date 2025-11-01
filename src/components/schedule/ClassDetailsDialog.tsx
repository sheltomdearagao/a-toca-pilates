import React, { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Check, X, Trash2, Edit } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { ClassEvent, ClassAttendee, AttendanceStatus } from '@/types/schedule';
import { StudentOption } from '@/types/student';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import EditClassDialog from './class-details/EditClassDialog';
import AddAttendeeSection from './class-details/AddAttendeeSection'; // Importar a seção de adição
import DeleteAttendeeAlertDialog from './class-details/DeleteAttendeeAlertDialog'; // Importar o diálogo de exclusão de participante
import DisplaceConfirmationAlertDialog from './class-details/DisplaceConfirmationAlertDialog'; // Importar o diálogo de deslocamento

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
  
  // Estados para Adicionar Participante
  const { data: allStudents, isLoading: isLoadingAllStudents } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
    enabled: isOpen,
  });
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);
  const [isDeleteAttendeeAlertOpen, setIsDeleteAttendeeAlertOpen] = useState(false);
  const [attendeeToDelete, setAttendeeToDelete] = useState<ClassAttendee | null>(null);
  const [isDisplaceConfirmationOpen, setIsDisplaceConfirmationOpen] = useState(false);
  const [studentToDisplace, setStudentToDisplace] = useState<ClassAttendee | null>(null);
  const [newStudentForDisplacement, setNewStudentForDisplacement] = useState<StudentOption | null>(null);

  const isClassFull = attendees.length >= classCapacity;
  const availableStudentsForAdd = allStudents?.filter(s => !attendees.some(a => a.students?.name === s.name));

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
  }, [isOpen, classEvent?.id, queryClient]); // Adicionado queryClient para garantir que o useEffect rode após mutações

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent?.id] });
    queryClient.invalidateQueries({ queryKey: ['classes'] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: AttendanceStatus }) => {
      const { error } = await supabase
        .from('class_attendees')
        .update({ status })
        .eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateQueries();
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
      invalidateQueries();
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
      invalidateQueries();
      showSuccess('Participante adicionado com sucesso!');
      setIsAddingAttendee(false);
    },
    onError: (error) => {
      showError(error.message);
      setIsAddingAttendee(false);
    },
  });

  const displaceAttendeeMutation = useMutation({
    mutationFn: async ({ studentIdToAdd, attendeeIdToRemove }: { studentIdToAdd: string; attendeeIdToRemove: string }) => {
      if (!classEvent?.id) throw new Error("ID da aula não encontrado.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Remover o aluno de menor prioridade
      const { error: removeError } = await supabase
        .from('class_attendees')
        .delete()
        .eq('id', attendeeIdToRemove);
      if (removeError) throw removeError;

      // 2. Adicionar o novo aluno
      const { error: addError } = await supabase
        .from('class_attendees')
        .insert({
          user_id: user.id,
          class_id: classEvent.id,
          student_id: studentIdToAdd,
          status: 'Agendado',
        });
      if (addError) throw addError;
    },
    onSuccess: () => {
      invalidateQueries();
      showSuccess('Aluno deslocado e novo participante adicionado com sucesso!');
      setIsDisplaceConfirmationOpen(false);
      setStudentToDisplace(null);
      setNewStudentForDisplacement(null);
      setIsAddingAttendee(false);
    },
    onError: (error) => {
      showError(error.message);
      setIsAddingAttendee(false);
    },
  });

  const handleUpdateStatus = useCallback((attendeeId: string, status: AttendanceStatus) => {
    updateStatusMutation.mutate({ attendeeId, status });
  }, [updateStatusMutation]);

  const handleRemoveAttendeeClick = useCallback((attendee: ClassAttendee) => {
    setAttendeeToDelete(attendee);
    setIsDeleteAttendeeAlertOpen(true);
  }, []);

  const handleConfirmRemoveAttendee = useCallback(() => {
    if (attendeeToDelete?.id) {
      removeAttendeeMutation.mutate(attendeeToDelete.id, {
        onSuccess: () => {
          setIsDeleteAttendeeAlertOpen(false);
          setAttendeeToDelete(null);
        }
      });
    }
  }, [attendeeToDelete, removeAttendeeMutation]);

  const handleAddAttendee = useCallback((studentId: string) => {
    setIsAddingAttendee(true);
    addAttendeeMutation.mutate(studentId);
  }, [addAttendeeMutation]);

  const handleConfirmDisplacement = useCallback(() => {
    if (newStudentForDisplacement?.id && studentToDisplace?.id) {
      setIsAddingAttendee(true);
      displaceAttendeeMutation.mutate({
        studentIdToAdd: newStudentForDisplacement.id,
        attendeeIdToRemove: studentToDisplace.id,
      });
    }
  }, [newStudentForDisplacement, studentToDisplace, displaceAttendeeMutation]);

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

  return (
    <>
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
            
            {/* Seção de Adicionar Participante */}
            <AddAttendeeSection
              availableStudentsForAdd={availableStudentsForAdd}
              isLoadingAllStudents={isLoadingAllStudents}
              isClassFull={isClassFull}
              onAddAttendee={handleAddAttendee}
              onConfirmDisplacement={handleConfirmDisplacement}
              isAddingAttendee={isAddingAttendee || addAttendeeMutation.isPending || displaceAttendeeMutation.isPending}
              isDisplaceConfirmationOpen={isDisplaceConfirmationOpen}
              onDisplaceConfirmationChange={setIsDisplaceConfirmationOpen}
              setStudentToDisplace={setStudentToDisplace}
              setNewStudentForDisplacement={setNewStudentForDisplacement}
              attendees={attendees}
              allStudents={allStudents}
            />

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
                            onClick={() => handleRemoveAttendeeClick(attendee)}
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

      {/* Diálogos auxiliares */}
      <DeleteAttendeeAlertDialog
        isOpen={isDeleteAttendeeAlertOpen}
        onOpenChange={setIsDeleteAttendeeAlertOpen}
        attendee={attendeeToDelete}
        onConfirmDelete={handleConfirmRemoveAttendee}
        isDeleting={removeAttendeeMutation.isPending}
      />
      
      <DisplaceConfirmationAlertDialog
        isOpen={isDisplaceConfirmationOpen}
        onOpenChange={setIsDisplaceConfirmationOpen}
        studentToDisplace={studentToDisplace}
        newStudentForDisplacement={newStudentForDisplacement}
        onConfirmDisplacement={handleConfirmDisplacement}
        isSubmitting={displaceAttendeeMutation.isPending}
      />
    </>
  );
};

export default ClassDetailsDialog;