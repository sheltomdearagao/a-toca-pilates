import StatCard from "../components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, DollarSign, AlertCircle, Calendar } from "lucide-react";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import BirthdayCard from "@/components/BirthdayCard"; // Importar o novo componente

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const fetchDashboardStats = async () => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  // 1. Active Students
  const { count: activeStudents, error: studentsError } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'Ativo');
  if (studentsError) throw new Error(`Alunos: ${studentsError.message}`);

  // 2. Monthly Revenue (paid transactions this month)
  const { data: revenueData, error: revenueError } = await supabase
    .from('financial_transactions')
    .select('amount')
    .eq('type', 'revenue')
    .eq('status', 'Pago')
    .gte('paid_at', monthStart.toISOString())
    .lte('paid_at', monthEnd.toISOString());
  if (revenueError) throw new Error(`Receita: ${revenueError.message}`);
  const monthlyRevenue = revenueData?.reduce((sum, t) => sum + t.amount, 0) || 0;

  // 3. Overdue Payments
  const { data: overdueData, error: overdueError } = await supabase
    .from('financial_transactions')
    .select('amount')
    .eq('type', 'revenue')
    .or(`status.eq.Atrasado,and(status.eq.Pendente,due_date.lt.${now.toISOString()})`);
  if (overdueError) throw new Error(`Inadimplência: ${overdueError.message}`);
  const totalOverdue = overdueData?.reduce((sum, t) => sum + t.amount, 0) || 0;

  // 4. Today's Classes
  const { count: todayClasses, error: classesError } = await supabase
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .gte('start_time', todayStart.toISOString())
    .lte('start_time', todayEnd.toISOString());
  if (classesError) throw new Error(`Aulas: ${classesError.message}`);

  return {
    activeStudents: activeStudents ?? 0,
    monthlyRevenue: formatCurrency(monthlyRevenue),
    totalOverdue: formatCurrency(totalOverdue),
    todayClasses: todayClasses ?? 0,
  };
};

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Alunos Ativos"
          value={stats?.activeStudents ?? 0}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Receita do Mês"
          value={stats?.monthlyRevenue ?? formatCurrency(0)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Inadimplência"
          value={stats?.totalOverdue ?? formatCurrency(0)}
          icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Aulas Hoje"
          value={stats?.todayClasses ?? 0}
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <BirthdayCard /> {/* Adicionando o card de aniversariantes */}
      </div>
    </div>
  );
};

export default Dashboard;