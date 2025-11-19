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

  // Mutação para apagar todos os alunos (incluindo de outros usuários)
  const deleteAllStudentsMutation = useMutation({
    mutationFn: async () => {
      console.log('🚀 Iniciando processo de apagar todos os alunos...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // 1. Apaga transações financeiras primeiro (sem filtro de student_id)
      console.log('💰 Apagando transações financeiras...');
      const { error: transactionsError } = await supabase
        .from('financial_transactions')
        .delete()
        .neq('id', null);

      if (transactionsError) {
        console.error('❌ Erro ao apagar transações:', transactionsError);
        throw new Error(`Erro ao apagar transações financeiras: ${transactionsError.message}`);
      }
      console.log('✅ Transações financeiras apagadas');

      // 2. Apaga participantes das aulas
      console.log('👥 Apagando participantes das aulas...');
      const { error: attendeesError } = await supabase
        .from('class_attendees')
        .delete()
        .neq('id', null);

      if (attendeesError) {
        console.error('❌ Erro ao apagar participantes:', attendeesError);
        throw new Error(`Erro ao apagar participantes: ${attendeesError.message}`);
      }
      console.log('✅ Participantes apagados');

      // 3. Apaga modelos recorrentes
      console.log('🔄 Apagando modelos recorrentes...');
      const { error: templatesError } = await supabase
        .from('recurring_class_templates')
        .delete()
        .neq('id', null);

      if (templatesError) {
        console.error('❌ Erro ao apagar modelos:', templatesError);
        throw new Error(`Erro ao apagar modelos recorrentes: ${templatesError.message}`);
      }
      console.log('✅ Modelos recorrentes apagados');

      // 4. Apaga todas as aulas
      console.log('📅 Apagando todas as aulas...');
      const { error: classesError } = await supabase
        .from('classes')
        .delete()
        .neq('id', null);

      if (classesError) {
        console.error('❌ Erro ao apagar aulas:', classesError);
        throw new Error(`Erro ao apagar aulas: ${classesError.message}`);
      }
      console.log('✅ Aulas apagadas');

      // 5. Finalmente, apaga todos os alunos (incluindo de outros usuários)
      console.log('👤 Apagando todos os alunos (incluindo de outros usuários)...');
      const { error: studentsError } = await supabase
        .from('students')
        .delete()
        .neq('id', null);

      if (studentsError) {
        console.error('❌ Erro ao apagar alunos:', studentsError);
        throw new Error(`Erro ao apagar alunos: ${studentsError.message}`);
      }
      console.log('✅ Alunos apagados');

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
      console.error('❌ Erro ao apagar todos os alunos:', error);
      showError(error.message || 'Erro ao apagar todos os alunos.');
    },
  });

  // Mutação para limpar toda a agenda
  const clearScheduleMutation = useMutation({
    mutationFn: async () => {
      console.log('🚀 Iniciando processo de limpar agenda...');
      
      // Apaga participantes das aulas
      console.log('👥 Apagando participantes...');
      const { error: attendeesError } = await supabase
        .from('class_attendees')
        .delete()
        .neq('id', null);

      if (attendeesError) {
        console.error('❌ Erro ao apagar participantes:', attendeesError);
        throw new Error(`Erro ao apagar participantes: ${attendeesError.message}`);
      }
      console.log('✅ Participantes apagados');

      // Apaga modelos recorrentes
      console.log('🔄 Apagando modelos recorrentes...');
      const { error: templatesError } = await supabase
        .from('recurring_class_templates')
        .delete()
        .neq('id', null);

      if (templatesError) {
        console.error('❌ Erro ao apagar modelos:', templatesError);
        throw new Error(`Erro ao apagar modelos recorrentes: ${templatesError.message}`);
      }
      console.log('✅ Modelos recorrentes apagados');

      // Apaga todas as aulas
      console.log('📅 Apagando todas as aulas...');
      const { error: classesError } = await supabase
        .from('classes')
        .delete()
        .neq('id', null);

      if (classesError) {
        console.error('❌ Erro ao apagar aulas:', classesError);
        throw new Error(`Erro ao apagar as aulas: ${classesError.message}`);
      }
      console.log('✅ Aulas apagadas');

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
      console.error('❌ Erro ao limpar agenda:', error);
      showError(error.message || 'Erro ao limpar a agenda.');
    },
  });

  // Mutação para resetar o sistema completo (virgem)
  const resetSystemMutation = useMutation({
    mutationFn: async () => {
      console.log('🚀 Iniciando RESET COMPLETO do sistema...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // Lista de tabelas para apagar
      const tables = [
        'financial_transactions',
        'class_attendees',
        'classes',
        'recurring_class_templates',
        'students',
        'profiles',
        'reposition_credit_entries',
        'reposition_credit_usage_log',
        'app_settings'
      ];

      console.log('📋 Tabelas a serem apagadas:', tables);

      // Apaga cada tabela
      for (const table of tables) {
        console.log(`🗑️ Apagando tabela: ${table}`);
        
        try {
          // Para profiles, mantém o admin atual
          const query = supabase
            .from(table)
            .delete();
          
          if (table === 'profiles') {
            query.neq('id', user.id);
          } else {
            query.neq('id', null);
          }
          
          const { error, count } = await query;
          
          if (error) {
            console.error(`❌ Erro ao apagar ${table}:`, error);
            throw new Error(`Erro ao apagar ${table}: ${error.message}`);
          }
          
          console.log(`✅ ${table}: ${count} registros apagados`);
        } catch (error) {
          console.error(`⚠️ Erro ao apagar ${table} (pode não existir):`, error);
          // Continua mesmo se a tabela não existir
        }
      }

      console.log('🎉 Sistema resetado com sucesso!');
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
      console.error('❌ Erro ao resetar sistema:', error);
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
              <p className="text-xs text-muted-foreground mt-2">
                Abra o console (F12) para ver o processo detalhado.
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
              <p className="text-xs text-muted-foreground mt-2">
                Abra o console (F12) para ver o processo detalhado.
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
              <p className="text-xs text-muted-foreground mt-2">
                Abra o console (F12) para ver o processo detalhado.
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