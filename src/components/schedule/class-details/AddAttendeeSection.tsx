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
import { StudentOption } from '@/types/student';

interface AddAttendeeSectionProps {
  availableStudentsForAdd: StudentOption[] | undefined;
  isLoadingAllStudents: boolean;
  isClassFull: boolean;
  onAddAttendee: (studentId: string) => void;
  onConfirmDisplacement: () => void;
  isAddingAttendee: boolean;
  isDisplaceConfirmationOpen: boolean;
  onDisplaceConfirmationChange: (isOpen: boolean) => void;
  setStudentToDisplace: (attendee: ClassAttendee | null) => void;
  setNewStudentForDisplacement: (student: StudentOption | null) => void;
  attendees: ClassAttendee[] | undefined;
  allStudents: StudentOption[] | undefined;
  credits: number;
  isLoadingCredits: boolean;
  selectedAttendanceType: string;
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
  credits,
  isLoadingCredits,
  selectedAttendanceType,
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

    // Check credit balance for 'Reposicao' type
    if (selectedAttendanceType === 'Reposicao' && !isLoadingCredits && credits < 1) {
      showError(`O aluno não possui créditos suficientes para reposição. Créditos disponíveis: ${credits}`);
      return;
    }

    if (!isClassFull) {
      // 1. Turma não está cheia: Adiciona diretamente
      onAddAttendee(studentToAdd.id);
    } else {
      // 2. Turma cheia: Verifica prioridade
      if (studentToAdd.enrollment_type === 'Particular') {
        // Aluno Particular pode deslocar Wellhub/TotalPass
        const displaceableStudents = attendees?.filter(
          a => a.students?.enrollment_type === 'Wellhub' || a.students?.enrollment_type === 'TotalPass'
        );

        if (displaceableStudents && displaceableStudents.length > 0) {
          // Desloca o primeiro aluno de menor prioridade encontrado
          setStudentToDisplace(displaceableStudents[0]);
          setNewStudentForDisplacement(studentToAdd);
          onDisplaceConfirmationChange(true);
        } else {
          showError("Turma cheia e não há alunos de menor prioridade para deslocar.");
        }
      } else {
        // Alunos Wellhub/TotalPass não podem deslocar ninguém
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