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
import { Loader2, Trash2, CalendarX, AlertTriangle, RefreshCw } from 'lucide-react';
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
  const [isResetSystemOpen, setIsResetSystemOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // Mutação para apagar todos os alunos
  const deleteAllStudentsMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // Apaga transações financeiras primeiro
      await supabase.from('financial_transactions').delete().neq('student_id', null);
      
      // Apaga participantes das aulas
      await supabase.from('class_attendees').delete().neq('student_id', null);
      
      // Apaga modelos recorrentes
      await supabase.from('recurring_class_templates').delete().neq('student_id', null);
      
      // Apaga aulas com aluno
      await supabase.from('classes').delete().neq('student_id', null);
      
      // Apaga todos os alunos
      await supabase.from('students').delete().neq('id', null);

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
      // Apaga participantes das aulas
      await supabase.from('class_attendees').delete().neq('class_id', null);
      
      // Apaga modelos recorrentes
      await supabase.from('recurring_class_templates').delete().neq('id', null);
      
      // Apaga todas as aulas
      await supabase.from('classes').delete().neq('id', null);

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

  // Mutação para resetar o sistema completo (virgem)
  const resetSystemMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // 1. Apaga todos os dados das tabelas principais
      await supabase.from('financial_transactions').delete().neq('id', null);
      await supabase.from('class_attendees').delete().neq('id', null);
      await supabase.from('classes').delete().neq('id', null);
      await supabase.from('recurring_class_templates').delete().neq('id', null);
      await supabase.from('students').delete().neq('id', null);
      
      // 2. Apaga todos os perfis exceto o admin atual
      await supabase.from('profiles').delete().neq('id', user.id);
      
      // 3. Reseta créditos de reposição (se existir a tabela)
      try {
        await supabase.from('reposition_credit_entries').delete().neq('id', null);
        await supabase.from('reposition_credit_usage_log').delete().neq('id', null);
      } catch (error) {
        console.log('Tabelas de crédito não encontradas, continuando...');
      }
      
      // 4. Reseta configurações do app (opcional)
      try {
        await supabase.from('app_settings').delete().neq('key', null);
      } catch (error) {
        console.log('Tabela de app_settings não encontrada, continuando...');
      }

      return true;
    },
    onSuccess: () => {
      // Invalida todas as queries possíveis
      queryClient.invalidateQueries();
      queryClient.clear();
      
      showSuccess('Sistema resetado com sucesso! O aplicativo está como novo.');
      setIsResetSystemOpen(false);
      
      // Recarrega a página após 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    },
    onError: (error: any) => {
      console.error('Erro ao resetar sistema:', error);
      showError(error.message || 'Erro ao resetar o sistema.');
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
          Apagar Alunos
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
          Limpar Agenda
        </Button>

        <Button
          variant="destructive"
          onClick={() => setIsResetSystemOpen(true)}
          disabled={resetSystemMutation.isPending}
          className="bg-red-600 hover:bg-red-700"
        >
          {resetSystemMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Resetar Sistema
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
                <strong>ATENÇÃO:</strong> Esta ação irá apagar:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Todos os alunos cadastrados</li>
                <li>Todas as transações financeiras relacionadas</li>
                <li>Participantes e aulas associadas</li>
                <li>Modelos de aulas recorrentes</li>
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
                'Sim, Apagar'
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
                <strong>ATENÇÃO:</strong> Esta ação irá apagar:
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
                'Sim, Limpar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para resetar o sistema completo */}
      <AlertDialog open={isResetSystemOpen} onOpenChange={setIsResetSystemOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-red-600" />
              Resetar Sistema Completo
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>⚠️ PERIGO MÁXIMO:</strong> Esta ação irá apagar TODOS os dados do sistema:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>✅ Todos os alunos e perfis</li>
                <li>✅ Todas as transações financeiras</li>
                <li>✅ Toda a agenda e aulas</li>
                <li>✅ Todos os créditos de reposição</li>
                <li>✅ Configurações do sistema</li>
              </ul>
              <p className="font-semibold text-red-600">
                O sistema ficará como novo (virgem)!
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Apenas seu perfil de admin será mantido.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetSystemMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetSystemMutation.mutate()}
              disabled={resetSystemMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {resetSystemMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Resetar Tudo'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminActions;