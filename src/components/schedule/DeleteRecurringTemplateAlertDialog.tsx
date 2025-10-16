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

interface DeleteRecurringTemplateAlertDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  templateTitle: string | undefined;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

const DeleteRecurringTemplateAlertDialog = ({
  isOpen,
  onOpenChange,
  templateTitle,
  onConfirmDelete,
  isDeleting,
}: DeleteRecurringTemplateAlertDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão do modelo recorrente</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o modelo de aula recorrente "{templateTitle}"?
            <br /><br />
            **Atenção:** Esta ação **não** excluirá as aulas individuais que já foram geradas a partir deste modelo. Elas precisarão ser excluídas manualmente, se necessário.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sim, excluir modelo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteRecurringTemplateAlertDialog;