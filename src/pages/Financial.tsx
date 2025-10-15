import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FinancialTransaction } from "@/types/financial";
import { Student } from "@/types/student";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from "date-fns";
import { ptBR } from 'date-fns/locale/pt-BR';
import FinancialOverviewCards from "@/components/financial/FinancialOverviewCards";
import MonthlyFinancialChart from "@/components/financial/MonthlyFinancialChart";
import AllTransactionsTable from "@/components/financial/AllTransactionsTable";
import OverdueTransactionsTable from "@/components/financial/OverdueTransactionsTable";
import AddEditTransactionDialog, { TransactionFormData } from "@/components/financial/AddEditTransactionDialog";
import DeleteTransactionAlertDialog from "@/components/financial/DeleteTransactionAlertDialog";
import FinancialTableSkeleton from "@/components/financial/FinancialTableSkeleton"; // Importar o novo componente
import { showError, showSuccess } from "@/utils/toast";
import ColoredSeparator from "@/components/ColoredSeparator";
import { Card } from "@/components/ui/card";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const fetchTransactions = async (): Promise<FinancialTransaction[]> => {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*, students(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
};

const fetchStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase.from("students").select("*").order("name");
  if (error) throw new Error(error.message);
  return data || [];
};

const fetchFinancialStats = async () => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [revenueResult, expenseResult, overdueResult] = await Promise.all([
    supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'revenue')
      .eq('status', 'Pago')
      .gte('paid_at', monthStart.toISOString())
      .lte('paid_at', monthEnd.toISOString()),
    supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'expense')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString()),
    supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'revenue')
      .or(`status.eq.Atrasado,and(status.eq.Pendente,due_date.lt.${now.toISOString()})`),
  ]);

  if (revenueResult.error) throw new Error(revenueResult.error.message);
  if (expenseResult.error) throw new Error(expenseResult.error.message);
  if (overdueResult.error) throw new Error(overdueResult.error.message);

  const monthlyRevenue = revenueResult.data?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const monthlyExpense = expenseResult.data?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalOverdue = overdueResult.data?.reduce((sum, t) => sum + t.amount, 0) || 0;

  return { monthlyRevenue, monthlyExpense, totalOverdue };
};

const fetchOverdueTransactions = async (): Promise<FinancialTransaction[]> => {
    const { data, error } = await supabase
    .from("financial_transactions")
    .select("*, students(name)")
    .eq('type', 'revenue')
    .or(`status.eq.Atrasado,and(status.eq.Pendente,due_date.lt.${new Date().toISOString()})`)
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

const fetchMonthlyChartData = async () => {
  const chartData = [];
  const promises = [];

  for (let i = 5; i >= 0; i--) { // Last 6 months
    const date = subMonths(new Date(), i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    promises.push(
      (async () => {
        const [revenueResult, expenseResult] = await Promise.all([
          supabase
            .from('financial_transactions')
            .select('amount')
            .eq('type', 'revenue')
            .eq('status', 'Pago')
            .gte('paid_at', monthStart.toISOString())
            .lte('paid_at', monthEnd.toISOString()),
          supabase
            .from('financial_transactions')
            .select('amount')
            .eq('type', 'expense')
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString()),
        ]);

        if (revenueResult.error) throw new Error(revenueResult.error.message);
        if (expenseResult.error) throw new Error(expenseResult.error.message);

        const monthlyRevenue = revenueResult.data?.reduce((sum, t) => sum + t.amount, 0) || 0;
        const monthlyExpense = expenseResult.data?.reduce((sum, t) => sum + t.amount, 0) || 0;

        return {
          month: format(date, 'MMM/yy', { locale: ptBR }),
          Receita: monthlyRevenue,
          Despesa: monthlyExpense,
        };
      })()
    );
  }
  const results = await Promise.all(promises);
  chartData.push(...results);
  return chartData;
};

const Financial = () => {
  const queryClient = useQueryClient();
  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);

  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
  const { data: students, isLoading: isLoadingStudents } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const { data: stats, isLoading: isLoadingStats } = useQuery({ queryKey: ["financialStats"], queryFn: fetchFinancialStats });
  const { data: overdueTransactions, isLoading: isLoadingOverdue } = useQuery({ queryKey: ["overdueTransactions"], queryFn: fetchOverdueTransactions });
  const { data: monthlyChartData, isLoading: isLoadingMonthlyChart } = useQuery({ queryKey: ["monthlyChartData"], queryFn: fetchMonthlyChartData });

  const mutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const dataToSubmit: any = {
        ...formData,
        user_id: user.id,
        due_date: formData.due_date ? format(formData.due_date, "yyyy-MM-dd") : null,
        status: formData.type === 'revenue' ? formData.status : null,
        student_id: formData.type === 'revenue' ? formData.student_id : null,
        is_recurring: false, // is_recurring is now managed by templates
      };
      if (formData.status === 'Pago') {
        dataToSubmit.paid_at = new Date().toISOString();
      } else {
        dataToSubmit.paid_at = null; // Clear paid_at if status is not 'Pago'
      }

      if (selectedTransaction) {
        const { error } = await supabase.from("financial_transactions").update(dataToSubmit).eq("id", selectedTransaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_transactions").insert([dataToSubmit]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financialStats"] });
      queryClient.invalidateQueries({ queryKey: ["overdueTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthlyChartData"] });
      showSuccess(`Lançamento ${selectedTransaction ? "atualizado" : "adicionado"} com sucesso!`);
      setFormOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financialStats"] });
      queryClient.invalidateQueries({ queryKey: ["overdueTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthlyChartData"] });
      showSuccess("Lançamento removido com sucesso!");
      setDeleteAlertOpen(false);
      setSelectedTransaction(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from('financial_transactions')
        .update({ status: 'Pago', paid_at: new Date().toISOString() })
        .eq('id', transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financialStats"] });
      queryClient.invalidateQueries({ queryKey: ["overdueTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthlyChartData"] });
      showSuccess('Transação marcada como paga com sucesso!');
    },
    onError: (error) => { showError(error.message); },
  });

  const handleAddNew = () => {
    setSelectedTransaction(null);
    setFormOpen(true);
  };

  const handleEdit = (transaction: FinancialTransaction) => {
    setSelectedTransaction(transaction);
    setFormOpen(true);
  };

  const handleDelete = (transaction: FinancialTransaction) => {
    setSelectedTransaction(transaction);
    setDeleteAlertOpen(true);
  };
  
  const onSubmitTransaction = (data: TransactionFormData) => { mutation.mutate(data); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Módulo Financeiro</h1>
        <Button onClick={handleAddNew}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Lançamento</Button>
      </div>

      <ColoredSeparator color="primary" className="my-6" />

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="all">Todos os Lançamentos</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4 space-y-6">
          <FinancialOverviewCards stats={stats} isLoading={isLoadingStats} formatCurrency={formatCurrency} />
          <ColoredSeparator color="accent" className="my-6" />
          <MonthlyFinancialChart data={monthlyChartData || []} isLoading={isLoadingMonthlyChart} />
          <h2 className="text-2xl font-bold mb-4">Lançamentos Atrasados</h2>
          {isLoadingOverdue ? (
            <FinancialTableSkeleton columns={6} rows={3} />
          ) : (
            <OverdueTransactionsTable
              overdueTransactions={overdueTransactions}
              isLoading={isLoadingOverdue}
              formatCurrency={formatCurrency}
              onMarkAsPaid={markAsPaidMutation.mutate}
            />
          )}
        </TabsContent>
        <TabsContent value="all" className="mt-4">
           {isLoadingTransactions ? (
             <FinancialTableSkeleton columns={8} rows={10} />
           ) : (
             <AllTransactionsTable
               transactions={transactions}
               isLoading={isLoadingTransactions}
               formatCurrency={formatCurrency}
               onEdit={handleEdit}
               onDelete={handleDelete}
               onMarkAsPaid={markAsPaidMutation.mutate}
             />
           )}
        </TabsContent>
      </Tabs>

      <AddEditTransactionDialog
        isOpen={isFormOpen}
        onOpenChange={setFormOpen}
        selectedTransaction={selectedTransaction}
        students={students}
        isLoadingStudents={isLoadingStudents}
        onSubmit={onSubmitTransaction}
        isSubmitting={mutation.isPending}
      />

      <DeleteTransactionAlertDialog
        isOpen={isDeleteAlertOpen}
        onOpenChange={setDeleteAlertOpen}
        selectedTransaction={selectedTransaction}
        onConfirmDelete={deleteMutation.mutate}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
};

export default Financial;