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

interface DeleteAttendeeAlertDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  attendeeName: string | undefined;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

const DeleteAttendeeAlertDialog = ({
  isOpen,
  onOpenChange,
  attendeeName,
  onConfirmDelete,
  isDeleting,
}: DeleteAttendeeAlertDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover aluno da aula?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover "{attendeeName}" desta aula?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sim, remover"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteAttendeeAlertDialog;