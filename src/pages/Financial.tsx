import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FinancialTransaction } from "@/types/financial";
import { Student } from "@/types/student";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Settings } from "lucide-react"; // Importando Settings
import { format, startOfMonth, endOfMonth, parseISO, subMonths, getYear, getMonth, setYear, setMonth } from "date-fns";
import { ptBR } from 'date-fns/locale/pt-BR';
import FinancialOverviewCards from "@/components/financial/FinancialOverviewCards";
import MonthlyFinancialChart from "@/components/financial/MonthlyFinancialChart";
import AllTransactionsTable from "@/components/financial/AllTransactionsTable";
import OverdueTransactionsTable from "@/components/financial/OverdueTransactionsTable";
import AddEditTransactionDialog, { TransactionFormData } from "@/components/financial/AddEditTransactionDialog";
import DeleteTransactionAlertDialog from "@/components/financial/DeleteTransactionAlertDialog";
import FinancialTableSkeleton from "@/components/financial/FinancialTableSkeleton";
import CategoryManagerDialog from "@/components/financial/CategoryManagerDialog"; // Importando o novo diálogo
import { showError, showSuccess } from "@/utils/toast";
import ColoredSeparator from "@/components/ColoredSeparator";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/utils/formatters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fetchTransactions = async (year: number, month: number): Promise<FinancialTransaction[]> => {
  const date = setMonth(setYear(new Date(), year), month);
  const monthStart = startOfMonth(date).toISOString();
  const monthEnd = endOfMonth(date).toISOString();

  // Filtra por created_at (para despesas) ou due_date/paid_at (para receitas) dentro do mês.
  // Para simplificar e garantir que todas as transações relevantes apareçam, vamos filtrar por created_at.
  // Se for necessário filtrar por due_date, a query precisará ser mais complexa (OR).
  // Por enquanto, filtramos por created_at para despesas e receitas criadas no mês.
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*, students(name, phone)") // Adicionado 'phone'
    .gte("created_at", monthStart)
    .lte("created_at", monthEnd)
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
    .select("*, students(name, phone)") // Adicionado 'phone'
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
  const now = useMemo(() => new Date(), []);
  
  // Estados para o filtro de data
  const [selectedMonth, setSelectedMonth] = useState(getMonth(now)); // 0-indexed
  const [selectedYear, setSelectedYear] = useState(getYear(now));

  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false); // Novo estado
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);

  const { data: students, isLoading: isLoadingStudents } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const { data: stats, isLoading: isLoadingStats } = useQuery({ queryKey: ["financialStats"], queryFn: fetchFinancialStats });
  const { data: overdueTransactions, isLoading: isLoadingOverdue } = useQuery({ queryKey: ["overdueTransactions"], queryFn: fetchOverdueTransactions });
  const { data: monthlyChartData, isLoading: isLoadingMonthlyChart } = useQuery({ queryKey: ["monthlyChartData"], queryFn: fetchMonthlyChartData });

  // Query de transações filtrada
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({ 
    queryKey: ["transactions", selectedYear, selectedMonth], 
    queryFn: () => fetchTransactions(selectedYear, selectedMonth),
  });

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

  const handleAddNew = useCallback(() => {
    setSelectedTransaction(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((transaction: FinancialTransaction) => {
    setSelectedTransaction(transaction);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((transaction: FinancialTransaction) => {
    setSelectedTransaction(transaction);
    setDeleteAlertOpen(true);
  }, []);
  
  const onSubmitTransaction = useCallback((data: TransactionFormData) => {
    mutation.mutate(data);
  }, [mutation]);

  // Dados para os seletores de data
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(setMonth(now, i), 'MMMM', { locale: ptBR }),
  }));
  const years = Array.from({ length: 5 }, (_, i) => getYear(now) - 2 + i); // Últimos 2 anos, ano atual e próximos 2 anos

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Módulo Financeiro</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCategoryManagerOpen(true)}>
            <Settings className="w-4 h-4 mr-2" /> Gerenciar Categorias
          </Button>
          <Button onClick={handleAddNew}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Lançamento</Button>
        </div>
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
          <div className="flex gap-4 mb-4">
            <div className="w-40">
              <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(parseInt(value, 10))}>
                <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(parseInt(value, 10))}>
                <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
        onConfirmDelete={() => selectedTransaction && deleteMutation.mutate(selectedTransaction.id)}
        isDeleting={deleteMutation.isPending}
      />
      
      <CategoryManagerDialog
        isOpen={isCategoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
      />
    </div>
  );
};

export default Financial;