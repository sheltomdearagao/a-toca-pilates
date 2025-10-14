import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClassEvent, ClassAttendee, AttendanceStatus } from '@/types/schedule';
import { StudentOption } from '@/types/student';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2, Edit, Trash2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { parseISO, format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

// Importar os novos componentes modulares
import ClassInfoDisplay from './class-details/ClassInfoDisplay';
import ClassEditForm, { ClassFormData } from './class-details/ClassEditForm';
import ClassAttendeesList from './class-details/ClassAttendeesList';
import AddAttendeeSection from './class-details/AddAttendeeSection';
import DeleteClassAlertDialog from './class-details/DeleteClassAlertDialog';
import DeleteAttendeeAlertDialog from './class-details/DeleteAttendeeAlertDialog';
import DisplaceConfirmationAlertDialog from './class-details/DisplaceConfirmationAlertDialog';

interface ClassDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  classEvent: Partial<ClassEvent> | null;
  classCapacity: number;
}

const fetchClassDetails = async (classId: string): Promise<Partial<ClassEvent> | null> => {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id,
      title,
      start_time,
      duration_minutes,
      notes,
      student_id,
      students(name)
    `)
    .eq('id', classId)
    .single();
  
  if (error) throw new Error(error.message);
  
  if (data) {
    return {
      ...data,
      // Ajustado para garantir que students seja um objeto único ou null
      students: (data.students as { name: string }[] | null)?.[0] || null,
    };
  }
  return null;
};

const fetchAttendees = async (classId: string): Promise<ClassAttendee[]> => {
  const { data, error } = await supabase
    .from('class_attendees')
    .select(`
      id,
      status,
      students(id, name, enrollment_type)
    `)
    .eq('class_id', classId);
  
  if (error) throw new Error(error.message);
  return data as unknown as ClassAttendee[] || [];
};

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, enrollment_type')
    .order('name');
  
  if (error) throw new Error(error.message);
  return data || [];
};

const ClassDetailsDialog = ({ isOpen, onOpenChange, classEvent, classCapacity }: ClassDetailsDialogProps) => {
  const queryClient = useQueryClient();
  const [isDeleteClassAlertOpen, setDeleteClassAlertOpen] = useState(false);
  const [isDeleteAttendeeAlertOpen, setDeleteAttendeeAlertOpen] = useState(false);
  const [attendeeToDelete, setAttendeeToDelete] = useState<ClassAttendee | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDisplaceConfirmationOpen, setDisplaceConfirmationOpen] = useState(false);
  const [studentToDisplace, setStudentToDisplace] = useState<ClassAttendee | null>(null);
  const [newStudentForDisplacement, setNewStudentForDisplacement] = useState<StudentOption | null>(null);

  const classId = classEvent?.id;

  const { data: details, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId!),
    enabled: !!classId,
    staleTime: 1000 * 60 * 2,
  });

  const { data: attendees, isLoading: isLoadingAttendees } = useQuery({
    queryKey: ['classAttendees', classId],
    queryFn: () => fetchAttendees(classId!),
    enabled: !!classId,
    staleTime: 1000 * 60 * 2,
  });

  const { data: allStudents, isLoading: isLoadingAllStudents } = useQuery<StudentOption[]>({ 
    queryKey: ['allStudents'], 
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
  });

  const addAttendeeMutation = useMutation({
    mutationFn: async ({ studentId, displaceAttendeeId }: { studentId: string, displaceAttendeeId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !classId) throw new Error('Dados inválidos.');

      if (displaceAttendeeId) {
        const { error: deleteError } = await supabase.from('class_attendees').delete().eq('id', displaceAttendeeId);
        if (deleteError) throw deleteError;
      }

      const { error: insertError } = await supabase.from('class_attendees').insert({
        user_id: user.id,
        class_id: classId,
        status: 'Agendado',
        student_id: studentId,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Aluno adicionado à aula!');
      setDisplaceConfirmationOpen(false);
      setStudentToDisplace(null);
      setNewStudentForDisplacement(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: AttendanceStatus }) => {
      const { error } = await supabase.from('class_attendees').update({ status }).eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classId] });
      showSuccess('Status de presença atualizado.');
    },
    onError: (error) => { showError(error.message); },
  });

  const removeAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase.from('class_attendees').delete().eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Aluno removido da aula!');
      setDeleteAttendeeAlertOpen(false);
      setAttendeeToDelete(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const updateClassMutation = useMutation({
    mutationFn: async (formData: ClassFormData) => {
      if (!classId) throw new Error("ID da aula não encontrado.");
      const classTitle = formData.student_id
        ? allStudents?.find(s => s.id === formData.student_id)?.name || 'Aula com Aluno'
        : formData.title;

      const startUtc = fromZonedTime(parseISO(formData.start_time), Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
      
      const dataToSubmit = {
        title: classTitle,
        start_time: startUtc,
        // Removido duration_minutes pois não existe no formData e todas as aulas são de 1 hora
        notes: formData.notes,
        student_id: formData.student_id || null,
      };
      const { error } = await supabase.from('classes').update(dataToSubmit).eq('id', classId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classDetails', classId] });
      showSuccess('Aula atualizada com sucesso!');
      setIsEditMode(false);
    },
    onError: (error) => { showError(error.message); },
  });

  const deleteClassMutation = useMutation({
    mutationFn: async () => {
      if (!classId) throw new Error("ID da aula não encontrado.");
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess("Aula excluída com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => { showError(error.message); }
  });

  const availableStudentsForAdd = allStudents?.filter(s => !attendees?.some(a => a.students.id === s.id));
  const isClassFull = (attendees?.length || 0) >= classCapacity;

  const handleEditSubmit = (data: ClassFormData) => {
    updateClassMutation.mutate(data);
  };

  const confirmRemoveAttendee = (attendee: ClassAttendee) => {
    setAttendeeToDelete(attendee);
    setDeleteAttendeeAlertOpen(true);
  };

  const handleConfirmDeleteAttendee = () => {
    if (attendeeToDelete) {
      removeAttendeeMutation.mutate(attendeeToDelete.id);
    }
  };

  const handleConfirmDeleteClass = () => {
    deleteClassMutation.mutate();
  };

  const handleAddAttendee = (studentId: string) => {
    addAttendeeMutation.mutate({ studentId });
  };

  const handleConfirmDisplacement = () => {
    if (newStudentForDisplacement && studentToDisplace) {
      addAttendeeMutation.mutate({
        studentId: newStudentForDisplacement.id,
        displaceAttendeeId: studentToDisplace.id,
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); setIsEditMode(false); }}>
        <DialogContent className="sm:max-w-lg">
          {isLoadingDetails ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando detalhes...</span>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {isEditMode ? "Editar Aula" : (details?.students?.name ? `Aula com ${details.students.name}` : details?.title)}
                </DialogTitle>
              </DialogHeader>

              {isEditMode ? (
                <ClassEditForm
                  classEvent={details}
                  allStudents={allStudents}
                  isLoadingAllStudents={isLoadingAllStudents}
                  onSubmit={handleEditSubmit}
                  onCancelEdit={() => setIsEditMode(false)}
                  isSubmitting={updateClassMutation.isPending}
                />
              ) : (
                <>
                  <div className="py-4 space-y-6">
                    <ClassInfoDisplay classEvent={details} />
                    <ClassAttendeesList
                      attendees={attendees}
                      isLoadingAttendees={isLoadingAttendees}
                      classCapacity={classCapacity}
                      onUpdateStatus={(attendeeId, status) => updateStatusMutation.mutate({ attendeeId, status })}
                      onRemoveAttendee={confirmRemoveAttendee}
                    />
                    <AddAttendeeSection
                      availableStudentsForAdd={availableStudentsForAdd}
                      isLoadingAllStudents={isLoadingAllStudents}
                      isClassFull={isClassFull}
                      onAddAttendee={handleAddAttendee}
                      onConfirmDisplacement={handleConfirmDisplacement}
                      isAddingAttendee={addAttendeeMutation.isPending}
                      isDisplaceConfirmationOpen={isDisplaceConfirmationOpen}
                      onDisplaceConfirmationChange={setDisplaceConfirmationOpen}
                      setStudentToDisplace={setStudentToDisplace}
                      setNewStudentForDisplacement={setNewStudentForDisplacement}
                      attendees={attendees}
                      allStudents={allStudents}
                    />
                  </div>
                  <DialogFooter className="sm:justify-between">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditMode(true)}>
                        <Edit className="w-4 h-4 mr-2" /> Editar Aula
                      </Button>
                      <Button variant="destructive" onClick={() => setDeleteClassAlertOpen(true)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir Aula
                      </Button>
                    </div>
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">Fechar</Button>
                    </DialogClose>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <DeleteClassAlertDialog
        isOpen={isDeleteClassAlertOpen}
        onOpenChange={setDeleteClassAlertOpen}
        classTitle={details?.title}
        onConfirmDelete={handleConfirmDeleteClass}
        isDeleting={deleteClassMutation.isPending}
      />

      <DeleteAttendeeAlertDialog
        isOpen={isDeleteAttendeeAlertOpen}
        onOpenChange={setDeleteAttendeeAlertOpen}
        attendeeName={attendeeToDelete?.students.name}
        onConfirmDelete={handleConfirmDeleteAttendee}
        isDeleting={removeAttendeeMutation.isPending}
      />

      <DisplaceConfirmationAlertDialog
        isOpen={isDisplaceConfirmationOpen}
        onOpenChange={setDisplaceConfirmationOpen}
        studentToDisplace={studentToDisplace}
        newStudentForDisplacement={newStudentForDisplacement}
        onConfirmDisplacement={handleConfirmDisplacement}
        isSubmitting={addAttendeeMutation.isPending}
      />
    </>
  );
};

export default ClassDetailsDialog;