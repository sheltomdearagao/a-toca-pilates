import StatCard from "../components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, DollarSign, AlertCircle, Calendar, UserX } from "lucide-react";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import BirthdayCard from "@/components/BirthdayCard";
import ColoredSeparator from "@/components/ColoredSeparator";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/utils/formatters";

const fetchDashboardStats = async () => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  // 1. Busca transações em atraso para calcular o valor total
  const { data: overdueData, error: overdueError } = await supabase
    .from('financial_transactions')
    .select('amount, student_id')
    .eq('type', 'revenue')
    .or(`status.eq.Atrasado,and(status.eq.Pendente,due_date.lt.${now.toISOString()})`);

  if (overdueError) throw new Error(`Inadimplência: ${overdueError.message}`);

  const totalOverdue = overdueData?.reduce((sum, t) => sum + t.amount, 0) || 0;
  
  // 2. Calcula a contagem de alunos únicos inadimplentes
  const uniqueOverdueStudents = new Set(overdueData?.map(t => t.student_id).filter(id => id !== null));
  const overdueStudentCount = uniqueOverdueStudents.size;

  // Executa as outras consultas em paralelo
  const [
    { count: activeStudents, error: studentsError },
    { data: revenueData, error: revenueError },
    { count: todayClasses, error: classesError },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Ativo'),
    supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'revenue')
      .eq('status', 'Pago')
      .gte('paid_at', monthStart.toISOString())
      .lte('paid_at', monthEnd.toISOString()),
    supabase
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString()),
  ]);

  if (studentsError) throw new Error(`Alunos: ${studentsError.message}`);
  if (revenueError) throw new Error(`Receita: ${revenueError.message}`);
  if (classesError) throw new Error(`Aulas: ${classesError.message}`);

  const monthlyRevenue = revenueData?.reduce((sum, t) => sum + t.amount, 0) || 0;

  return {
    activeStudents: activeStudents ?? 0,
    monthlyRevenue: formatCurrency(monthlyRevenue),
    totalOverdue: formatCurrency(totalOverdue),
    overdueStudentCount: overdueStudentCount, // Nova métrica
    todayClasses: todayClasses ?? 0,
  };
};

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    staleTime: 1000 * 60 * 10, // Aumentado para 10 minutos
  });

  const logoUrl = "https://nkwsvsmmzvukdghlyxpm.supabase.co/storage/v1/object/public/app-assets/atocalogo.png";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img src={logoUrl} alt="A Toca Pilates Logo" className="w-10 h-10 object-contain" />
          <h1 className="text-4xl font-bold text-foreground">
            Dashboard
          </h1>
        </div>
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
          variant="bordered-green"
        />
        <StatCard
          title="Receita do Mês"
          value={stats?.monthlyRevenue ?? formatCurrency(0)}
          icon={<DollarSign className="h-6 w-6" />}
          isLoading={isLoading}
          variant="bordered-green"
        />
        <StatCard
          title="Alunos Inadimplentes"
          value={stats?.overdueStudentCount ?? 0}
          icon={<UserX className="h-6 w-6" />}
          isLoading={isLoading}
          variant="bordered-red"
        />
        <StatCard
          title="Aulas Hoje"
          value={stats?.todayClasses ?? 0}
          icon={<Calendar className="h-6 w-6" />}
          isLoading={isLoading}
          variant="bordered-yellow"
        />
      </div>
      
      <ColoredSeparator color="primary" className="my-8" />
      
      <Card className="shadow-impressionist shadow-subtle-glow">
        <BirthdayCard />
      </Card>
      
      <ColoredSeparator color="accent" className="my-8" />
    </div>
  );
};

export default Dashboard;