import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, CalendarX, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionProvider';

interface AdminActionsProps {
  className?: string;
}

const AdminActions = ({ className }: AdminActionsProps) => {
  const { profile } = useSession();
  const isAdmin = profile?.role === 'admin';
  
  const [isDeleteStudentsOpen, setIsDeleteStudentsOpen] = useState(false);
  const [isClearScheduleOpen, setIsClearScheduleOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // Mutação para apagar todos os alunos
  const deleteAllStudentsMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // Primeiro, apaga todas as transações financeiras relacionadas aos alunos
      const { error: transactionsError } = await supabase
        .from('financial_transactions')
        .delete()
        .neq('student_id', null);

      if (transactionsError) {
        console.error('Erro ao apagar transações:', transactionsError);
        throw new Error('Erro ao apagar transações financeiras dos alunos.');
      }

      // Apaga todos os participantes das aulas
      const { error: attendeesError } = await supabase
        .from('class_attendees')
        .delete()
        .neq('student_id', null);

      if (attendeesError) {
        console.error('Erro ao apagar participantes:', attendeesError);
        throw new Error('Erro ao apagar participantes das aulas.');
      }

      // Apaga todos os modelos de aulas recorrentes
      const { error: templatesError } = await supabase
        .from('recurring_class_templates')
        .delete()
        .neq('student_id', null);

      if (templatesError) {
        console.error('Erro ao apagar modelos recorrentes:', templatesError);
        throw new Error('Erro ao apagar modelos de aulas recorrentes.');
      }

      // Apaga todas as aulas que têm aluno associado
      const { error: classesError } = await supabase
        .from('classes')
        .delete()
        .neq('student_id', null);

      if (classesError) {
        console.error('Erro ao apagar aulas:', classesError);
        throw new Error('Erro ao apagar aulas dos alunos.');
      }

      // Finalmente, apaga todos os alunos
      const { error: studentsError } = await supabase
        .from('students')
        .delete()
        .neq('id', null);

      if (studentsError) {
        console.error('Erro ao apagar alunos:', studentsError);
        throw new Error('Erro ao apagar alunos.');
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['studentStats'] });
      queryClient.invalidateQueries({ queryKey: ['studentPaymentStatus'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['recurringClassTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['birthdayStudents'] });
      showSuccess('Todos os alunos foram apagados com sucesso!');
      setIsDeleteStudentsOpen(false);
    },
    onError: (error: any) => {
      console.error('Erro ao apagar todos os alunos:', error);
      showError(error.message || 'Erro ao apagar todos os alunos.');
    },
  });

  // Mutação para limpar toda a agenda
  const clearScheduleMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // Apaga todos os participantes das aulas
      const { error: attendeesError } = await supabase
        .from('class_attendees')
        .delete()
        .neq('class_id', null);

      if (attendeesError) {
        console.error('Erro ao apagar participantes:', attendeesError);
        throw new Error('Erro ao apagar participantes das aulas.');
      }

      // Apaga todos os modelos de aulas recorrentes
      const { error: templatesError } = await supabase
        .from('recurring_class_templates')
        .delete()
        .neq('id', null);

      if (templatesError) {
        console.error('Erro ao apagar modelos recorrentes:', templatesError);
        throw new Error('Erro ao apagar modelos de aulas recorrentes.');
      }

      // Apaga todas as aulas
      const { error: classesError } = await supabase
        .from('classes')
        .delete()
        .neq('id', null);

      if (classesError) {
        console.error('Erro ao apagar aulas:', classesError);
        throw new Error('Erro ao apagar as aulas.');
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['recurringClassTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      showSuccess('Toda a agenda foi limpa com sucesso!');
      setIsClearScheduleOpen(false);
    },
    onError: (error: any) => {
      console.error('Erro ao limpar agenda:', error);
      showError(error.message || 'Erro ao limpar a agenda.');
    },
  });

  // Se não for admin, não renderiza nada
  if (!isAdmin) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          onClick={() => setIsDeleteStudentsOpen(true)}
          disabled={deleteAllStudentsMutation.isPending}
        >
          {deleteAllStudentsMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Apagar Todos os Alunos
        </Button>

        <Button
          variant="destructive"
          onClick={() => setIsClearScheduleOpen(true)}
          disabled={clearScheduleMutation.isPending}
        >
          {clearScheduleMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CalendarX className="mr-2 h-4 w-4" />
          )}
          Limpar Toda a Agenda
        </Button>
      </div>

      {/* AlertDialog para apagar todos os alunos */}
      <AlertDialog open={isDeleteStudentsOpen} onOpenChange={setIsDeleteStudentsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Apagar Todos os Alunos
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>ATENÇÃO:</strong> Esta ação é <span className="text-destructive font-bold">IRREVERSÍVEL</span> e irá apagar:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Todos os alunos cadastrados</li>
                <li>Todas as transações financeiras relacionadas aos alunos</li>
                <li>Todos os participantes das aulas</li>
                <li>Todos os modelos de aulas recorrentes</li>
                <li>Todas as aulas associadas aos alunos</li>
              </ul>
              <p className="font-semibold text-destructive">
                Esta ação não pode ser desfeita!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAllStudentsMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllStudentsMutation.mutate()}
              disabled={deleteAllStudentsMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteAllStudentsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Sim, Apagar Tudo'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para limpar toda a agenda */}
      <AlertDialog open={isClearScheduleOpen} onOpenChange={setIsClearScheduleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Limpar Toda a Agenda
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>ATENÇÃO:</strong> Esta ação é <span className="text-destructive font-bold">IRREVERSÍVEL</span> e irá apagar:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Todas as aulas agendadas</li>
                <li>Todos os participantes das aulas</li>
                <li>Todos os modelos de aulas recorrentes</li>
              </ul>
              <p className="font-semibold text-destructive">
                Esta ação não pode ser desfeita!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearScheduleMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearScheduleMutation.mutate()}
              disabled={clearScheduleMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {clearScheduleMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Sim, Limpar Agenda'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminActions;