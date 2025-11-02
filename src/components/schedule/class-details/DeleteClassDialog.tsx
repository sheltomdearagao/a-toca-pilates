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
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const returnCreditMutation = useMutation({
    mutationFn: async (studentId: string) => {
      // Incrementa o crédito do aluno
      const { error } = await supabase.rpc('increment_reposition_credit', {
        p_student_id: studentId,
        p_amount: 1,
      });
      if (error) throw error;
    },
    onSuccess: (data, studentId) => {
      queryClient.invalidateQueries({ queryKey: ['repositionCredits', studentId] });
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', studentId] });
    },
    onError: (error) => {
      console.error("Falha ao devolver crédito:", error);
      showError("Erro ao devolver crédito de reposição.");
    }
  });

  const handleDelete = async () => {
    if (!classId) return;
    setIsDeleting(true);
    
    try {
      // 1. Buscar participantes antes de deletar
      const { data: attendees, error: fetchError } = await supabase
        .from('class_attendees')
        .select('student_id, attendance_type')
        .eq('class_id', classId);

      if (fetchError) throw fetchError;

      // 2. Deletar participantes e a aula (mantendo a ordem para evitar erros de FK)
      await supabase.from('class_attendees').delete().eq('class_id', classId);
      const { error: deleteClassError } = await supabase.from('classes').delete().eq('id', classId);
      if (deleteClassError) throw deleteClassError;

      // 3. Devolver créditos se for Reposição
      const repositions = attendees.filter(a => a.attendance_type === 'Reposicao' && a.student_id);
      
      for (const attendee of repositions) {
        if (attendee.student_id) {
          await returnCreditMutation.mutateAsync(attendee.student_id);
        }
      }

      showSuccess('Aula apagada e créditos devolvidos (se aplicável)!');
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
            Se a aula for uma Reposição, o crédito será devolvido ao aluno.
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