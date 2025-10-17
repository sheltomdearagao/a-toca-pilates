import { useState, useEffect, useMemo } from 'react'; // Adicionado useMemo
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { parseISO, format, set } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

// Importar os novos componentes modulares
import ClassInfoDisplay from './class-details/ClassInfoDisplay';
import ClassEditForm, { ClassFormData } from './class-details/ClassEditForm';
import ClassAttendeesList from './class-details/ClassAttendeesList';
import AddAttendeeSection from './class-details/AddAttendeeSection';
import DeleteClassAlertDialog from './class-details/DeleteClassAlertDialog';
import DeleteAttendeeAlertDialog from './class-details/DeleteAttendeeAlertDialog';
import DisplaceConfirmationAlertDialog from './class-details/DisplaceConfirmationAlertDialog';
import { useClassManagement } from '@/hooks/useClassManagement'; // Importar o novo hook

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

  const {
    addAttendee,
    isAddingAttendee,
    updateAttendeeStatus,
    isUpdatingAttendeeStatus,
    removeAttendee,
    isRemovingAttendee,
    updateClass,
    isUpdatingClass,
    deleteClass,
    isDeletingClass,
  } = useClassManagement({ classId, allStudents });

  const handleEditSubmit = async (data: ClassFormData) => {
    await updateClass(data);
    setIsEditMode(false); // Fechar modo de edição após sucesso
  };

  const confirmRemoveAttendee = (attendee: ClassAttendee) => {
    setAttendeeToDelete(attendee);
    setDeleteAttendeeAlertOpen(true);
  };

  const handleConfirmDeleteAttendee = async () => {
    if (attendeeToDelete) {
      await removeAttendee(attendeeToDelete.id);
      setDeleteAttendeeAlertOpen(false);
      setAttendeeToDelete(null);
    }
  };

  const handleConfirmDeleteClass = async () => {
    await deleteClass();
    onOpenChange(false); // Fechar o diálogo principal após exclusão da aula
  };

  const handleAddAttendee = async (studentId: string) => {
    await addAttendee({ studentId });
    setDisplaceConfirmationOpen(false); // Fechar diálogo de confirmação de deslocamento se estiver aberto
    setStudentToDisplace(null);
    setNewStudentForDisplacement(null);
  };

  const handleConfirmDisplacement = async () => {
    if (newStudentForDisplacement && studentToDisplace) {
      await addAttendee({
        studentId: newStudentForDisplacement.id,
        displaceAttendeeId: studentToDisplace.id,
      });
      setDisplaceConfirmationOpen(false);
      setStudentToDisplace(null);
      setNewStudentForDisplacement(null);
    }
  };

  // Memoize this calculation to prevent re-running on every render
  const availableStudentsForAdd = useMemo(() => {
    return allStudents?.filter(s => !attendees?.some(a => a.students.id === s.id));
  }, [allStudents, attendees]);

  const isClassFull = (attendees?.length || 0) >= classCapacity;

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
                  allStudents={availableStudentsForAdd} // Passando a lista memoizada
                  isLoadingAllStudents={isLoadingAllStudents}
                  onSubmit={handleEditSubmit}
                  onCancelEdit={() => setIsEditMode(false)}
                  isSubmitting={isUpdatingClass}
                />
              ) : (
                <>
                  <div className="py-4 space-y-6">
                    <ClassInfoDisplay classEvent={details} />
                    <ClassAttendeesList
                      attendees={attendees}
                      isLoadingAttendees={isLoadingAttendees}
                      classCapacity={classCapacity}
                      onUpdateStatus={(attendeeId, status) => updateAttendeeStatus({ attendeeId, status })}
                      onRemoveAttendee={confirmRemoveAttendee}
                    />
                    <AddAttendeeSection
                      availableStudentsForAdd={availableStudentsForAdd}
                      isLoadingAllStudents={isLoadingAllStudents}
                      isClassFull={isClassFull}
                      onAddAttendee={handleAddAttendee}
                      onConfirmDisplacement={handleConfirmDisplacement}
                      isAddingAttendee={isAddingAttendee}
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
        isDeleting={isDeletingClass}
      />

      <DeleteAttendeeAlertDialog
        isOpen={isDeleteAttendeeAlertOpen}
        onOpenChange={setDeleteAttendeeAlertOpen}
        attendeeName={attendeeToDelete?.students.name}
        onConfirmDelete={handleConfirmDeleteAttendee}
        isDeleting={isRemovingAttendee}
      />

      <DisplaceConfirmationAlertDialog
        isOpen={isDisplaceConfirmationOpen}
        onOpenChange={setDisplaceConfirmationOpen}
        studentToDisplace={studentToDisplace}
        newStudentForDisplacement={newStudentForDisplacement}
        onConfirmDisplacement={handleConfirmDisplacement}
        isSubmitting={isAddingAttendee}
      />
    </>
  );
};

export default ClassDetailsDialog;