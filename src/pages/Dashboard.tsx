import StatCard from "../components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, DollarSign, AlertCircle, Calendar } from "lucide-react";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import BirthdayCard from "@/components/BirthdayCard";
import ColoredSeparator from "@/components/ColoredSeparator";
import { Card } from "@/components/ui/card";

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
    <div className="space-y-8 animate-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Dashboard
        </h1>
        <div className="text-sm text-muted-foreground">
          Bem-vindo de volta! 👋
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Alunos Ativos"
          value={stats?.activeStudents ?? 0}
          icon={<Users className="h-6 w-6" />}
          isLoading={isLoading}
          variant="gradient"
        />
        <StatCard
          title="Receita do Mês"
          value={stats?.monthlyRevenue ?? formatCurrency(0)}
          icon={<DollarSign className="h-6 w-6" />}
          isLoading={isLoading}
          variant="gradient-accent"
        />
        <StatCard
          title="Inadimplência"
          value={stats?.totalOverdue ?? formatCurrency(0)}
          icon={<AlertCircle className="h-6 w-6" />}
          isLoading={isLoading}
          variant="gradient-destructive"
        />
        <StatCard
          title="Aulas Hoje"
          value={stats?.todayClasses ?? 0}
          icon={<Calendar className="h-6 w-6" />}
          isLoading={isLoading}
          variant="bordered"
        />
      </div>
      
      <ColoredSeparator color="primary" className="my-8" />
      
      <Card variant="bordered" className="animate-slide-in">
        <BirthdayCard />
      </Card>
      
      <ColoredSeparator color="accent" className="my-8" />
    </div>
  );
};

export default Dashboard;