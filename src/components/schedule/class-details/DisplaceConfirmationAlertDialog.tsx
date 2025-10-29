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
import type { ClassAttendee } from '@/types/schedule';
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
            A turma está cheia. O aluno <strong>{newStudentForDisplacement?.name}</strong> pode ocupar a vaga de <strong>{studentToDisplace?.students?.name}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmDisplacement} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sim, deslocar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DisplaceConfirmationAlertDialog;