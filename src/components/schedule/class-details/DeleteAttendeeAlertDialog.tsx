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

interface DeleteAttendeeAlertDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  attendee: ClassAttendee | null;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

const DeleteAttendeeAlertDialog = ({
  isOpen,
  onOpenChange,
  attendee,
  onConfirmDelete,
  isDeleting,
}: DeleteAttendeeAlertDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover Aluno da Aula?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover "{attendee?.students?.name || 'este aluno'}" desta aula?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sim, excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteAttendeeAlertDialog;