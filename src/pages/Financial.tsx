import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialTransaction } from '@/types/financial';
import { StudentOption } from '@/types/student';
import { formatCurrency } from '@/utils/formatters';
import { showError, showSuccess } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings, DollarSign, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AddEditTransactionDialog, { TransactionFormData } from '@/components/financial/AddEditTransactionDialog';
import AllTransactionsTable from '@/components/financial/AllTransactionsTable';
import FinancialOverviewCards from '@/components/financial/FinancialOverviewCards';
import MonthlyFinancialChart from '@/components/financial/MonthlyFinancialChart';
import ColoredSeparator from '@/components/ColoredSeparator';
import { startOfMonth, endOfMonth, subMonths, format as formatDate, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';

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

  const { data: transactionsData, error: tError } = await supabase
    .from('financial_transactions')
    .select('*, students(name)')
    .order('created_at', { ascending: false });
  if (tError) throw tError;
  const transactions = (transactionsData || []) as FinancialTransaction[];

  const { data: studentsData, error: sError } = await supabase
    .from('students')
    .select('id, name')
    .order('name');
  if (sError) throw sError;
  const students = (studentsData || []) as StudentOption[];

  // Totais
  let monthlyRevenue = 0;
  let monthlyExpense = 0;
  let totalOverdue = 0;
  transactions.forEach((t) => {
    const paidAt = t.paid_at ? parseISO(t.paid_at) : null;
    if (paidAt && paidAt >= monthStart && paidAt <= monthEnd) {
      if (t.type === 'revenue') monthlyRevenue += t.amount;
      else if (t.type === 'expense') monthlyExpense += t.amount;
    }
    if (t.type === 'revenue' && (t.status === 'Atrasado' || (t.status === 'Pendente' && t.due_date && parseISO(t.due_date) < now))) {
      totalOverdue += t.amount;
    }
  });

  // Dados do gráfico últimos 6 meses
  const months: { key: string; date: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i);
    months.push({ key: formatDate(d, 'MMM/yy', { locale: ptBR }), date: d });
  }
  const chartMap = new Map<string, { Receita: number; Despesa: number }>();
  months.forEach(m => chartMap.set(m.key, { Receita: 0, Despesa: 0 }));
  transactions.forEach((t) => {
    if (t.paid_at) {
      const paidAt = parseISO(t.paid_at);
      const key = formatDate(paidAt, 'MMM/yy', { locale: ptBR });
      const entry = chartMap.get(key);
      if (entry) {
        if (t.type === 'revenue') entry.Receita += t.amount;
        if (t.type === 'expense') entry.Despesa += t.amount;
      }
    }
  });
  const chartData: ChartData[] = months.map(m => ({
    month: m.key,
    Receita: chartMap.get(m.key)!.Receita,
    Despesa: chartMap.get(m.key)!.Despesa,
  }));

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
  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Filtros locais
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'revenue' | 'expense'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pago' | 'Pendente' | 'Atrasado'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');

  const filtered = useMemo(() => {
    return (data?.transactions || []).filter(t => {
      if (searchTerm) {
        const name = t.students?.name || '';
        const hay = `${t.description || ''} ${name}`.toLowerCase();
        if (!hay.includes(searchTerm.toLowerCase())) return false;
      }
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (studentFilter !== 'all' && t.student_id !== studentFilter) return false;
      return true;
    });
  }, [data, searchTerm, typeFilter, statusFilter, categoryFilter, studentFilter]);

  // Edição de lançamento
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<FinancialTransaction | null>(null);
  const upsert = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const payload = {
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
      if (selected) {
        await supabase.from('financial_transactions').update(payload).eq('id', selected.id);
      } else {
        await supabase.from('financial_transactions').insert([payload]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      showSuccess(`Lançamento ${selected ? 'atualizado' : 'registrado'}!`);
      setDialogOpen(false);
      setSelected(null);
    },
    onError: err => showError(err.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      showSuccess('Lançamento excluído!');
    },
    onError: err => showError(err.message),
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-primary rounded-xl">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Financeiro</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setSelected(null); setDialogOpen(true); }}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Lançamento
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Settings className="w-4 h-4 mr-2" /> Configurações
          </Button>
        </div>
      </div>

      {/* Gráficos */}
      <ColoredSeparator color="primary" />
      <FinancialOverviewCards stats={data?.stats} isLoading={isLoading} formatCurrency={formatCurrency} />
      <MonthlyFinancialChart data={data?.chartData || []} isLoading={isLoading} />

      {/* Filtros */}
      <ColoredSeparator color="primary" />
      <Card className="shadow-impressionist shadow-subtle-glow p-4">
        <div className="grid grid-cols-6 gap-4 items-center">
          <div className="col-span-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              className="input input-bordered w-full"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select className="select" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
            <option value="all">Todos</option>
            <option value="revenue">Receita</option>
            <option value="expense">Despesa</option>
          </select>
          <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="all">Todos</option>
            <option value="Pago">Pago</option>
            <option value="Pendente">Pendente</option>
            <option value="Atrasado">Atrasado</option>
          </select>
          <select className="select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">Todas</option>
            {(appSettings?.revenue_categories ?? appSettings?.expense_categories ?? []).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="select" value={studentFilter} onChange={e => setStudentFilter(e.target.value)}>
            <option value="all">Todos</option>
            {(data?.students || []).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tabela de lançamentos */}
      <AllTransactionsTable
        transactions={filtered}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
        onEdit={t => { setSelected(t); setDialogOpen(true); }}
        onDelete={t => del.mutate(t.id)}
        onMarkAsPaid={() => {}}
      />

      {/* Diálogo de criação/edição */}
      <AddEditTransactionDialog
        isOpen={isDialogOpen}
        onOpenChange={setDialogOpen}
        selectedTransaction={selected || undefined}
        onSubmit={d => upsert.mutate(d)}
        isSubmitting={upsert.isPending}
        students={data?.students || []}
        isLoadingStudents={false}
      />
    </div>
);
};

export default Financial;