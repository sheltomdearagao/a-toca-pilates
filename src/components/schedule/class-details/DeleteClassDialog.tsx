import React, { useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface DeleteClassDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null | undefined;
  classTitle?: string;
  onDeleted?: () => void;
}

const DeleteClassDialog = ({
  isOpen,
  onOpenChange,
  classId,
  classTitle,
  onDeleted,
}: DeleteClassDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!classId) return;
    setIsDeleting(true);
    try {
      // Primeiro deletar atendentes
      await supabase.from('class_attendees').delete().eq('class_id', classId);
      // Em seguida, deletar a aula
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;

      showSuccess('Aula apagada com sucesso!');
      onOpenChange(false);
      onDeleted?.();
    } catch (err: any) {
      showError(err?.message ?? 'Erro ao excluir a aula.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Aula</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a aula{classTitle ? ` "${classTitle}"` : ''}?
            Esta ação remove a aula da agenda e todos os participantes associados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Excluir Aula"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteClassDialog;