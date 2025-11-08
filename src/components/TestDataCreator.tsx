import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Loader2, TestTube } from 'lucide-react';
import { format, addDays } from 'date-fns';

const TestDataCreator = () => {
  const queryClient = useQueryClient();

  const createBirthdayStudentMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // Cria um aluno com aniversário este mês (dia 15)
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1; // 1-12
      const birthdayDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15`;

      const { error } = await supabase.from('students').insert({
        user_id: user.id,
        name: 'João Teste Aniversário',
        status: 'Ativo',
        plan_type: 'Mensal',
        plan_frequency: '3x',
        monthly_fee: 260,
        enrollment_type: 'Particular',
        date_of_birth: birthdayDate,
        phone: '(11) 99999-9999',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['birthdayStudents'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      showSuccess('Aluno de teste criado com aniversário este mês!');
    },
    onError: (error: any) => {
      showError(error.message);
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // Busca um aluno ativo qualquer
      const { data: students, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('status', 'Ativo')
        .limit(1)
        .single();

      if (studentError || !students) {
        throw new Error('Nenhum aluno ativo encontrado. Crie um aluno primeiro.');
      }

      // Cria uma transação pendente com vencimento em 5 dias
      const dueDate = format(addDays(new Date(), 5), 'yyyy-MM-dd');

      const { error } = await supabase.from('financial_transactions').insert({
        user_id: user.id,
        student_id: students.id,
        description: 'Mensalidade Teste',
        category: 'Mensalidade',
        amount: 260,
        type: 'revenue',
        status: 'Pendente',
        due_date: dueDate,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      showSuccess('Pagamento de teste criado com vencimento em 5 dias!');
    },
    onError: (error: any) => {
      showError(error.message);
    },
  });

  return (
    <Card className="shadow-impressionist shadow-subtle-glow border-2 border-dashed border-primary/50">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <TestTube className="w-5 h-5 mr-2 text-primary" />
          Criar Dados de Teste
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Use esses botões para criar dados de teste e verificar se os cards funcionam corretamente.
          </p>
          <div className="flex gap-2">
            <Button 
              onClick={() => createBirthdayStudentMutation.mutate()}
              disabled={createBirthdayStudentMutation.isPending}
              variant="outline"
            >
              {createBirthdayStudentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Aluno Aniversariante
            </Button>
            <Button 
              onClick={() => createPaymentMutation.mutate()}
              disabled={createPaymentMutation.isPending}
              variant="outline"
            >
              {createPaymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Pagamento a Vencer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TestDataCreator;