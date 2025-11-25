import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialTransaction } from '@/types/financial';
import { StudentOption } from '@/types/student';
import { formatCurrency } from '@/utils/formatters';
import { showError, showSuccess } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Settings, DollarSign, Search, ListChecks, TrendingUp, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AddEditTransactionDialog from '@/components/financial/AddEditTransactionDialog';
import { TransactionFormData } from '@/components/financial/AddEditTransactionDialog.schema';
import AllTransactionsTable from '@/components/financial/AllTransactionsTable';
import FinancialOverviewCards from '@/components/financial/FinancialOverviewCards';
import MonthlyFinancialChart from '@/components/financial/MonthlyFinancialChart';
import { ColoredSeparator } from '@/components/ColoredSeparator';
import { startOfMonth, endOfMonth, subMonths, format as formatDate, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
import CategoryManagerDialog from '@/components/financial/CategoryManagerDialog';

type ChartData = {
  month: string;
  Receita: number;
  Despesa: number;
};

type FinancialData = {
  transactions: FinancialTransaction[];
  stats: { monthlyRevenue: number; monthlyExpense: number; totalOverdue: number; };
  chartData: ChartData[];
  students: StudentOption[];
};

const fetchFinancialData = async (): Promise<FinancialData> => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const { data: transactionsData } = await supabase
    .from('financial_transactions')
    .select('*, students(name)')
    .order('created_at', { ascending: false });

  const transactions = (transactionsData || []) as FinancialTransaction[];

  const { data: studentsData } = await supabase
    .from('students')
    .select('id, name')
    .order('name');
  const students = (studentsData || []) as StudentOption[];

  // Totais
  let monthlyRevenue = 0;
  let monthlyExpense = 0;
  let totalOverdue = 0;

  const overdue = transactions.filter((t) =>
    t.type === 'revenue' &&
    (t.status === 'Atrasado' || (t.status === 'Pendente' && t.due_date && parseISO(t.due_date) < now))
  );
  totalOverdue = overdue.reduce((sum, t) => sum + t.amount, 0);

  transactions.forEach((t) => {
    const paidAt = t.paid_at ? parseISO(t.paid_at) : null;
    if (paidAt && paidAt >= monthStart && paidAt <= monthEnd) {
      if (t.type === 'revenue') monthlyRevenue += t.amount;
      if (t.type === 'expense') monthlyExpense += t.amount;
    }
  });

  // Chart data: last 6 months (oldest to newest)
  const monthsDates = Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i));
  const chartKeys = monthsDates.map(d => formatDate(d, 'MMM/yy', { locale: ptBR }));
  const chartDataMap = new Map<string, { Receita: number; Despesa: number }>();
  chartKeys.forEach((k) => chartDataMap.set(k, { Receita: 0, Despesa: 0 }));

  transactions.forEach((t) => {
    const paidAt = t.paid_at ? parseISO(t.paid_at) : null;
    if (paidAt) {
      const key = formatDate(paidAt, 'MMM/yy', { locale: ptBR });
      const entry = chartDataMap.get(key);
      if (entry) {
        if (t.type === 'revenue') entry.Receita += t.amount;
        if (t.type === 'expense') entry.Despesa += t.amount;
      }
    }
  });

  const chartData: ChartData[] = monthsDates.map((d) => {
    const key = formatDate(d, 'MMM/yy', { locale: ptBR });
    const entry = chartDataMap.get(key) || { Receita: 0, Despesa: 0 };
    return { month: key, Receita: entry.Receita, Despesa: entry.Despesa };
  });

  return { transactions, stats: { monthlyRevenue, monthlyExpense, totalOverdue }, chartData, students };
};

const Financial = () => {
  const { data: appSettings } = useAppSettings();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<FinancialData>({
    queryKey: ['financialData'],
    queryFn: fetchFinancialData,
    staleTime: 1000 * 60 * 5,
  });

  const { profile } = useSession();
  const isAdmin = profile?.role === 'admin';
  if (!isAdmin) return <Navigate to="/" replace />;

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all'|'revenue'|'expense'>('all');
  const [statusFilter, setStatusFilter] = useState<'all'|'Pago'|'Pendente'|'Atrasado'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<keyof FinancialTransaction>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filteredTransactions = useMemo(() => {
    const list = data?.transactions ?? [];
    return list.filter((t) => {
      // Filtros
      if (searchTerm) {
        const name = t.students?.name || '';
        const hay = `${t.description ?? ''} ${name}`.toLowerCase();
        if (!hay.includes(searchTerm.toLowerCase())) return false;
      }
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (studentFilter !== 'all' && t.student_id !== studentFilter) return false;
      
      return true;
    });
  }, [data, searchTerm, typeFilter, statusFilter, categoryFilter, studentFilter]);

  // Ordenação
  const sortedTransactions = useMemo(() => {
    const list = filteredTransactions || [];
    return [...list].sort((a, b) => {
      let aValue: any = a[sortColumn];
      let bValue: any = b[sortColumn];
      
      // Formatar datas para comparação
      if (sortColumn === 'created_at' || sortColumn === 'due_date' || sortColumn === 'paid_at') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        aValue = aValue;
        bValue = bValue;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTransactions, sortColumn, sortDirection]);

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);

  // Create/Update
  const upsertMutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const { data: { user } = { user: null } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');
      
      const payload: any = {
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
        // Garante que o user_id não seja alterado durante a edição
        delete payload.user_id; 
        await supabase.from('financial_transactions').update(payload).eq('id', selectedTransaction.id);
      } else {
        await supabase.from('financial_transactions').insert([payload]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      showSuccess(`Lançamento ${selectedTransaction ? 'atualizado' : 'criado'} com sucesso!`);
      setIsAddEditOpen(false);
      setSelectedTransaction(null);
    },
    onError: (err: any) => showError(err.message),
  });

  // Mark as Paid Mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      // Apenas marca a transação como paga. A atualização da validade do aluno deve ser feita manualmente
      // ou através do fluxo de edição do aluno, onde a duração da validade é conhecida.
      const { error } = await supabase
        .from('financial_transactions')
        .update({ status: 'Pago', paid_at: new Date().toISOString() })
        .eq('id', transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      showSuccess('Lançamento marcado como pago! Lembre-se de atualizar a validade do aluno, se necessário.');
    },
    onError: (err: any) => showError(err.message),
  });

  const handleAdd = () => {
    setSelectedTransaction(null);
    setIsAddEditOpen(true);
  };

  const handleAddRevenue = () => {
    setSelectedTransaction(null);
    setIsAddEditOpen(true);
  };

  const handleEdit = (t: FinancialTransaction) => {
    setSelectedTransaction(t);
    setIsAddEditOpen(true);
  };

  const onDelete = (t: FinancialTransaction) => deleteMutation.mutate(t.id);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      showSuccess('Lançamento removido com sucesso!');
    },
    onError: (err: any) => showError(err.message),
  });

  // Combina todas as categorias únicas para o filtro
  const allCategories = useMemo(() => {
    const revenue = appSettings?.revenue_categories || [];
    const expense = appSettings?.expense_categories || [];
    return Array.from(new Set([...revenue, ...expense]));
  }, [appSettings]);

  const handleSort = (column: keyof FinancialTransaction) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-primary rounded-xl">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestão Financeira</h1>
            <p className="text-muted-foreground">
              Lançamentos, status de pagamento e edição de valores.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCategoryManagerOpen(true)}>
            <ListChecks className="w-4 h-4 mr-2" /> Gerenciar Categorias
          </Button>
          <Button onClick={handleAdd}>
            <PlusCircle className="w-4 h-4 mr-2" /> Novo Lançamento
          </Button>
          <Button onClick={handleAddRevenue} className="bg-green-600 hover:bg-green-700">
            <TrendingUp className="w-4 h-4 mr-2" /> Lançar Receita
          </Button>
        </div>
      </div>

      <ColoredSeparator color="primary" />

      <FinancialOverviewCards stats={data?.stats} isLoading={isLoading} formatCurrency={formatCurrency} />
      <MonthlyFinancialChart data={data?.chartData || []} isLoading={isLoading} />

      <Card className="shadow-impressionist shadow-subtle-glow">
        <CardHeader>
          <CardTitle className="flex items-center"><Search className="w-5 h-5 mr-2" /> Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-6 gap-4 mb-4 items-center">
            <div className="col-span-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar descrição ou aluno..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Tipo</span>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
                <option value="all">Todos</option>
                <option value="revenue">Receita</option>
                <option value="expense">Despesa</option>
              </select>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="all">Todos</option>
                <option value="Pago">Pago</option>
                <option value="Pendente">Pendente</option>
                <option value="Atrasado">Atrasado</option>
              </select>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Categoria</span>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">Todas</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Aluno</span>
              <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
                <option value="all">Todos</option>
                {data?.students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <AllTransactionsTable
            transactions={sortedTransactions}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
            onEdit={handleEdit}
            onDelete={onDelete}
            onMarkAsPaid={markAsPaidMutation.mutate}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />

          <AddEditTransactionDialog
            isOpen={isAddEditOpen}
            onOpenChange={setIsAddEditOpen}
            selectedTransaction={selectedTransaction ?? undefined}
            onSubmit={(data) => upsertMutation.mutate(data)}
            isSubmitting={upsertMutation.isPending}
            students={data?.students ?? []}
            isLoadingStudents={false}
          />
          
          <CategoryManagerDialog
            isOpen={isCategoryManagerOpen}
            onOpenChange={setIsCategoryManagerOpen}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Financial;