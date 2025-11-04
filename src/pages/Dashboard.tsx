import StatCard from "../components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, DollarSign, AlertCircle, Calendar, UserX } from "lucide-react";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import BirthdayCard from "@/components/BirthdayCard";
import ColoredSeparator from "@/components/ColoredSeparator";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/utils/formatters";
import PaymentDueAlert from "@/components/PaymentDueAlert"; // Importar o novo componente

// Atualização: fetchDashboardStats com tipagem estável para TS
const fetchDashboardStats = async () => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  // Consulta 1: pagamentos atrasados (inadimplentes)
  const overdueQuery = supabase
    .from('financial_transactions')
    .select('amount, student_id')
    .eq('type', 'revenue')
    .or(`status.eq.Atrasado,and(status.eq.Pendente,due_date.lt.${now.toISOString()})`);

  // Consulta 2: alunos ativos
  const activeQuery = supabase.from('students').select('id', { count: 'exact', head: true }).eq('status','Ativo');

  // Consulta 3: receita paga no mês
  const revenueQuery = supabase.from('financial_transactions')
    .select('amount')
    .eq('type','revenue')
    .eq('status','Pago')
    .gte('paid_at', monthStart.toISOString())
    .lte('paid_at', monthEnd.toISOString());

  // Consulta 4: aulas hoje
  const classesQuery = supabase.from('classes')
    .select('id', { count: 'exact', head: true })
    .gte('start_time', todayStart.toISOString())
    .lte('start_time', todayEnd.toISOString());

  const [overdueRes, activeRes, revenueRes, classesRes] = await Promise.all([
    overdueQuery, activeQuery, revenueQuery, classesQuery
  ]) as any[];

  const overdueData = overdueRes?.data ?? [];
  const totalOverdue = overdueData.reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0);

  const overdueStudentCount = new Set((overdueData.map((t: any) => t.student_id)).filter((id: any) => id != null)).size;

  const activeStudents = activeRes?.count ?? 0;

  const revenueData = revenueRes?.data ?? [];
  const monthlyRevenueValue = revenueData?.reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0) ?? 0;

  const todayClasses = classesRes?.count ?? 0;

  return {
    activeStudents,
    monthlyRevenue: formatCurrency(monthlyRevenueValue),
    totalOverdue: formatCurrency(totalOverdue),
    overdueStudentCount,
    todayClasses
  };
};

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    // Cache seguro para UX estável
    staleTime: 1000 * 60 * 10,
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
      
      <PaymentDueAlert /> {/* NOVO ALERTA AQUI */}

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