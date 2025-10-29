import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';
import type { ClassAttendee } from '@/types/schedule';
import { StudentOption, Student } from '@/types/student';
import { ClassAttendee as _CA } from '@/types/schedule';

interface AddAttendeeSectionProps {
  availableStudentsForAdd: StudentOption[] | undefined;
  isLoadingAllStudents: boolean;
  isClassFull: boolean;
  onAddAttendee: (studentId: string) => void;
  onConfirmDisplacement: () => void;
  isAddingAttendee: boolean;
  isDisplaceConfirmationOpen: boolean;
  onDisplaceConfirmationChange: (isOpen: boolean) => void;
  setStudentToDisplace: (attendee: _CA | null) => void;
  setNewStudentForDisplacement: (student: StudentOption | null) => void;
  attendees: _CA[] | undefined;
  allStudents: StudentOption[] | undefined;
}

const AddAttendeeSection = React.memo(({
  availableStudentsForAdd,
  isLoadingAllStudents,
  isClassFull,
  onAddAttendee,
  onConfirmDisplacement,
  isAddingAttendee,
  isDisplaceConfirmationOpen,
  onDisplaceConfirmationChange,
  setStudentToDisplace,
  setNewStudentForDisplacement,
  attendees,
  allStudents,
}: AddAttendeeSectionProps) => {
  const [selectedStudentIdToAdd, setSelectedStudentIdToAdd] = useState<string | null>(null);

  const handleAddStudentClick = () => {
    if (!selectedStudentIdToAdd) {
      showError("Selecione um aluno para adicionar.");
      return;
    }

    const studentToAdd = allStudents?.find(s => s.id === selectedStudentIdToAdd);
    if (!studentToAdd) {
      showError("Aluno não encontrado.");
      return;
    }

    if (!isClassFull) {
      onAddAttendee(studentToAdd.id);
    } else {
      if (studentToAdd.enrollment_type === 'Particular') {
        const displaceableStudents = attendees?.filter(
          a => a.students?.enrollment_type === 'Wellhub' || a.students?.enrollment_type === 'TotalPass'
        );

        if (displaceableStudents && displaceableStudents.length > 0) {
          setStudentToDisplace(displaceableStudents[0]);
          setNewStudentForDisplacement(studentToAdd);
          onDisplaceConfirmationChange(true);
        } else {
          showError("Turma cheia e não há alunos de menor prioridade para deslocar.");
        }
      } else {
        showError("Turma cheia. Apenas alunos 'Particulares' podem deslocar outros alunos.");
      }
    }
  };

  return (
    <div>
      <h4 className="font-semibold mb-2">Adicionar Aluno à Aula</h4>
      <div className="flex gap-2">
        <Select onValueChange={setSelectedStudentIdToAdd} value={selectedStudentIdToAdd || ''}>
          <SelectTrigger><SelectValue placeholder="Selecione um aluno..." /></SelectTrigger>
          <SelectContent>
            {isLoadingAllStudents ? (
              <SelectItem value="loading" disabled>Carregando...</SelectItem>
            ) : (
              availableStudentsForAdd?.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.enrollment_type})</SelectItem>)
            )}
          </SelectContent>
        </Select>
        <Button onClick={handleAddStudentClick} disabled={!selectedStudentIdToAdd || isAddingAttendee}>
          {isAddingAttendee && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <UserPlus className="w-4 h-4 mr-2" /> Adicionar
        </Button>
      </div>
    </div>
  );
});

export default AddAttendeeSection;