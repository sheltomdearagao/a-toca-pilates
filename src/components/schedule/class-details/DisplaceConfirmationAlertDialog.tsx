import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ClassAttendee } from '@/types/schedule';
import { StudentOption } from '@/types/student';

interface DisplaceConfirmationAlertDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  studentToDisplace: ClassAttendee | null;
  newStudentForDisplacement: StudentOption | null;
  onConfirmDisplacement: () => void;
  isSubmitting: boolean;
}

const DisplaceConfirmationAlertDialog = ({
  isOpen,
  onOpenChange,
  studentToDisplace,
  newStudentForDisplacement,
  onConfirmDisplacement,
  isSubmitting,
}: DisplaceConfirmationAlertDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Turma Cheia - Deslocar Aluno?</AlertDialogTitle>
          <AlertDialogDescription>
            A turma está cheia. O aluno **{newStudentForDisplacement?.name}** (Particular) pode ocupar a vaga de **{studentToDisplace?.students.name}** ({studentToDisplace?.students.enrollment_type}). Deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmDisplacement} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sim, deslocar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DisplaceConfirmationAlertDialog;