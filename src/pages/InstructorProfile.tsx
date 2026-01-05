import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ColoredSeparator } from "@/components/ColoredSeparator";
import InstructorHeaderActions from '@/components/instructors/profile/InstructorHeaderActions';
import InstructorDetailsCard from '@/components/instructors/profile/InstructorDetailsCard';
import InstructorAttendanceHistory from '@/components/instructors/profile/InstructorAttendanceHistory';
import AddEditInstructorDialog from '@/components/instructors/AddEditInstructorDialog';
import { useInstructorProfileData } from '@/hooks/useInstructorProfileData';
import { useInstructors, InstructorFormData } from '@/hooks/useInstructors'; // Importar useInstructors e InstructorFormData
import { useAppSettings } from '@/hooks/useAppSettings'; // Importar useAppSettings

const InstructorProfile = () => {
  const { instructorId } = useParams<{ instructorId: string }>();
  const [isEditFormOpen, setEditFormOpen] = useState(false);

  const { 
    instructor, 
    classesTaught, 
    hasMoreClasses, 
    isLoading, 
    isFetching, 
    error, 
    loadMoreClasses 
  } = useInstructorProfileData(instructorId);

  const { updateInstructor } = useInstructors(); // Usar o hook de instrutores para a mutação de update
  const { data: appSettings } = useAppSettings(); // Para obter a capacidade da aula
  const classCapacity = appSettings?.class_capacity ?? 10;

  const handleSubmitInstructor = (data: InstructorFormData) => {
    if (instructorId) {
      updateInstructor.mutate({ id: instructorId, ...data }, {
        onSuccess: () => setEditFormOpen(false),
      });
    }
  };

  if (error) {
    return <div className="text-center text-destructive">Erro ao carregar o perfil do instrutor: {error.message}</div>;
  }
  
  if (!instructorId) {
    return <div className="text-center text-destructive">ID do instrutor não fornecido.</div>;
  }

  return (
    <div className="space-y-6">
      <InstructorHeaderActions
        instructor={instructor}
        isLoading={isLoading}
        onEdit={() => setEditFormOpen(true)}
      />

      <ColoredSeparator color="primary" className="my-6" />

      <div className="grid lg:grid-cols-4 gap-6">
        <InstructorDetailsCard instructor={instructor} isLoading={isLoading} />
        <InstructorAttendanceHistory
          classesTaught={classesTaught}
          isLoading={isLoading}
          hasMore={hasMoreClasses}
          onLoadMore={loadMoreClasses}
          isFetching={isFetching}
          classCapacity={classCapacity}
        />
      </div>

      <AddEditInstructorDialog
        isOpen={isEditFormOpen}
        onOpenChange={setEditFormOpen}
        selectedInstructor={instructor}
        onSubmit={handleSubmitInstructor}
        isSubmitting={updateInstructor.isPending}
      />
    </div>
  );
};

export default InstructorProfile;