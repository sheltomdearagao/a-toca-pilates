import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialTransaction, TransactionType } from '@/types/financial';
import { StudentOption } from '@/types/student';
import { formatCurrency } from '@/utils/formatters';
import { showError, showSuccess } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import FinancialOverviewCards from '@/components/financial/FinancialOverviewCards';
import MonthlyFinancialChart from '@/components/financial/MonthlyFinancialChart';
import OverdueTransactionsTable from '@/components/financial/OverdueTransactionsTable';
import AllTransactionsTable from '@/components/financial/AllTransactionsTable';
import AddEditTransactionDialog, { TransactionFormData } from '@/components/financial/AddEditTransactionDialog';
import DeleteTransactionAlertDialog from '@/components/financial/DeleteTransactionAlertDialog';
import CategoryManagerDialog from '@/components/financial/CategoryManagerDialog';
import ColoredSeparator from '@/components/ColoredSeparator';
import { startOfMonth, endOfMonth, subMonths, format, parseISO, parse } from 'date-fns'; // Adicionado 'parse'
import { ptBR } from 'date-fns/locale/pt-BR';
import { useSession } from '@/contexts/SessionProvider';
import { Navigate } from 'react-router-dom';

interface FinancialStats {
  monthlyRevenue: number;
  monthlyExpense: number;
  totalOverdue: number;
}

interface ChartData {
  month: string;
  Receita: number;
  Despesa: number;
}

const fetchFinancialData = async (): Promise<{ transactions: FinancialTransaction[], stats: FinancialStats, chartData: ChartData[], students: StudentOption[] }> => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // 1. Fetch all transactions for the table view
  const { data: transactionsData, error: transactionsError } = await supabase
    .from('financial_transactions')
    .select(`
      *,
      students(name, phone)
    `)
    .order('created_at', { ascending: false });

  if (transactionsError) throw new Error(`Transações: ${transactionsError.message}`);
  const transactions = transactionsData || [];

  // 2. Fetch students for dropdowns
  const { data: studentsData, error: studentsError } = await supabase
    .from('students')
    .select('id, name, enrollment_type')
    .order('name');

  if (studentsError) throw new Error(`Alunos: ${studentsError.message}`);
  const students = studentsData || [];

  // 3. Calculate Stats (Current Month)
  let monthlyRevenue = 0;
  let monthlyExpense = 0;
  let totalOverdue = 0;

  const overdueTransactions = transactions.filter(t => 
    t.type === 'revenue' && 
    (t.status === 'Atrasado' || (t.status === 'Pendente' && t.due_date && parseISO(t.due_date) < now))
  );
  
  totalOverdue = overdueTransactions.reduce((sum, t) => sum + t.amount, 0);

  transactions.forEach(t => {
    const paidAt = t.paid_at ? parseISO(t.paid_at) : null;
    
    if (paidAt && paidAt >= monthStart && paidAt <= monthEnd) {
      if (t.type === 'revenue') {
        monthlyRevenue += t.amount;
      } else if (t.type === 'expense') {
        monthlyExpense += t.amount;
      }
    }
  });

  const stats: FinancialStats = { monthlyRevenue, monthlyExpense, totalOverdue };

  // 4. Calculate Chart Data (Last 6 months)
  const chartDataMap: Record<string, { Receita: number, Despesa: number }> = {};
  
  for (let i = 0; i < 6; i++) {
    const date = subMonths(now, i);
    const monthKey = format(date, 'MMM/yy', { locale: ptBR });
    chartDataMap[monthKey] = { Receita: 0, Despesa: 0 };
  }

  transactions.forEach(t => {
    const paidAt = t.paid_at ? parseISO(t.paid_at) : null;
    if (paidAt) {
      const monthKey = format(paidAt, 'MMM/yy', { locale: ptBR });
      if (chartDataMap[monthKey]) {
        if (t.type === 'revenue') {
          chartDataMap[monthKey].Receita += t.amount;
        } else if (t.type === 'expense') {
          chartDataMap[monthKey].Despesa += t.amount;
        }
      }
    }
  });

  const chartData: ChartData[] = Object.keys(chartDataMap)
    .sort((a, b) => parse(a, 'MMM/yy', new Date()).getTime() - parse(b, 'MMM/yy', new Date()).getTime())
    .map(month => ({
      month,
      Receita: chartDataMap[month].Receita,
      Despesa: chartDataMap[month].Despesa,
    }));

  return { transactions, stats, chartData, students };
};

const Financial = () => {
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const isAdmin = profile?.role === 'admin';

  // Se não for admin, redireciona para o dashboard (ou mostra erro)
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['financialData'],
    queryFn: fetchFinancialData,
    staleTime: 1000 * 60 * 5,
  });

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  const addEditMutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const transactionData = {
        user_id: user.id,
        student_id: formData.student_id,
        description: formData.description,
        category: formData.category,
        amount: formData.amount,
        type: formData.type,
        status: formData.status,
        due_date: formData.due_date,
        paid_at: formData.status === 'Pago' ? new Date().toISOString() : null,
      };

      if (selectedTransaction) {
        // Update
        const { error } = await supabase.from('financial_transactions').update(transactionData).eq('id', selectedTransaction.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase.from('financial_transactions').insert([transactionData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      showSuccess(`Lançamento ${selectedTransaction ? 'atualizado' : 'registrado'} com sucesso!`);
      setIsAddEditOpen(false);
      setSelectedTransaction(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      showSuccess("Lançamento removido com sucesso!");
      setIsDeleteAlertOpen(false);
      setSelectedTransaction(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase.from('financial_transactions').update({ status: 'Pago', paid_at: new Date().toISOString() }).eq('id', transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      showSuccess('Transação marcada como paga com sucesso!');
    },
    onError: (error) => { showError(error.message); },
  });

  const handleAddTransaction = useCallback(() => {
    setSelectedTransaction(null);
    setIsAddEditOpen(true);
  }, []);

  const handleEditTransaction = useCallback((transaction: FinancialTransaction) => {
    setSelectedTransaction(transaction);
    setIsAddEditOpen(true);
  }, []);

  const handleDeleteTransaction = useCallback((transaction: FinancialTransaction) => {
    setSelectedTransaction(transaction);
    setIsDeleteAlertOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (selectedTransaction) {
      deleteMutation.mutate(selectedTransaction.id);
    }
  }, [selectedTransaction, deleteMutation]);

  const handleMarkAsPaid = useCallback((transactionId: string) => {
    markAsPaidMutation.mutate(transactionId);
  }, [markAsPaidMutation]);

  const overdueTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    const now = new Date();
    return data.transactions.filter(t => 
      t.type === 'revenue' && 
      (t.status === 'Atrasado' || (t.status === 'Pendente' && t.due_date && parseISO(t.due_date) < now))
    ).slice(0, 5); // Mostrar apenas os 5 mais recentes/importantes
  }, [data?.transactions]);

  if (error) {
    return <div className="text-center text-destructive">Erro ao carregar dados financeiros: {error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-primary rounded-xl">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Gestão Financeira
            </h1>
            <p className="text-muted-foreground">
              Visão geral de receitas, despesas e inadimplência.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCategoryManagerOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Categorias
          </Button>
          <Button onClick={handleAddTransaction}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      <ColoredSeparator color="primary" />

      <FinancialOverviewCards
        stats={data?.stats}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <MonthlyFinancialChart
          data={data?.chartData || []}
          isLoading={isLoading}
        />
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold flex items-center text-destructive">
            <TrendingDown className="w-5 h-5 mr-2" /> Inadimplência (Top 5)
          </h2>
          <OverdueTransactionsTable
            overdueTransactions={overdueTransactions}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
            onMarkAsPaid={handleMarkAsPaid}
          />
        </div>
      </div>

      <ColoredSeparator color="accent" />

      <h2 className="text-2xl font-bold mb-4">Todos os Lançamentos</h2>
      <AllTransactionsTable
        transactions={data?.transactions}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
        onMarkAsPaid={handleMarkAsPaid}
      />

      <AddEditTransactionDialog
        isOpen={isAddEditOpen}
        onOpenChange={setIsAddEditOpen}
        selectedTransaction={selectedTransaction}
        onSubmit={addEditMutation.mutate}
        isSubmitting={addEditMutation.isPending}
        students={data?.students}
        isLoadingStudents={isLoading}
      />

      <DeleteTransactionAlertDialog
        isOpen={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
        selectedTransaction={selectedTransaction}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />

      <CategoryManagerDialog
        isOpen={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
      />
    </div>
  );
};

export default Financial;