import React from "react";
import StatCard from "../components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, DollarSign, Calendar, UserX } from "lucide-react";
import { startOfMonth, endOfMonth, startOfDay, endOfDay, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import BirthdayCard from "@/components/BirthdayCard";
import { ColoredSeparator } from "@/components/ColoredSeparator";
import { formatCurrency } from "@/utils/formatters";
import PaymentDueAlert from "@/components/PaymentDueAlert";
import { useSession } from "@/contexts/SessionProvider";
import UpcomingPaymentsCard from "@/components/UpcomingPaymentsCard";
import DataMigrationTool from "@/components/DataMigrationTool";
import { Link } from "react-router-dom";

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const fetchDashboardStats = async () => {
  const now = new Date();

  // Month totals
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Compute "today" start/end in local timezone, then convert to UTC ISO strings for querying the DB
  const todayStartLocal = startOfDay(now);
  const todayEndLocal = endOfDay(now);

  const todayStartUtc = fromZonedTime(todayStartLocal, TIME_ZONE).toISOString();
  const todayEndUtc = fromZonedTime(todayEndLocal, TIME_ZONE).toISOString();

  // 1) Inadimplência: fetch revenues where status in ('Atrasado','Pendente') and evaluate in JS
  const { data: overdueRaw = [], error: overdueError } = await supabase
    .from("financial_transactions")
    .select("amount, student_id, status, due_date")
    .eq("type", "revenue")
    .in("status", ["Atrasado", "Pendente"]);

  if (overdueError) {
    throw overdueError;
  }

  // Compute total overdue amount and number of distinct overdue students (considering Pendente with due_date < now)
  const totalOverdue = (overdueRaw || []).reduce((sum: number, item: any) => {
    const status = item?.status;
    const amount = Number(item?.amount ?? 0);
    if (status === "Atrasado") return sum + amount;
    if (status === "Pendente" && item?.due_date) {
      const due = parseISO(item.due_date);
      if (due < now) return sum + amount;
    }
    return sum;
  }, 0);

  const overdueStudentSet = new Set<string>();
  (overdueRaw || []).forEach((item: any) => {
    const status = item?.status;
    if (!item?.student_id) return;
    if (status === "Atrasado") overdueStudentSet.add(item.student_id);
    if (status === "Pendente" && item?.due_date) {
      const due = parseISO(item.due_date);
      if (due < now) overdueStudentSet.add(item.student_id);
    }
  });
  const overdueStudentCount = overdueStudentSet.size;

  // 2) Active students count
  const { count: activeCount = 0 } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("status", "Ativo");

  // 3) Monthly revenue (paid_at within current month)
  const { data: revenueData = [], error: revenueError } = await supabase
    .from("financial_transactions")
    .select("amount")
    .eq("type", "revenue")
    .eq("status", "Pago")
    .gte("paid_at", monthStart.toISOString())
    .lte("paid_at", monthEnd.toISOString());

  if (revenueError) {
    throw revenueError;
  }

  const monthlyRevenueValue = (revenueData || []).reduce((sum: number, r: any) => sum + Number(r?.amount ?? 0), 0);

  // 4) Classes today: use the UTC bounds computed from local day range
  const { count: todayClassesCount = 0, error: classesError } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .gte("start_time", todayStartUtc)
    .lte("start_time", todayEndUtc);

  if (classesError) {
    throw classesError;
  }

  return {
    activeStudents: activeCount ?? 0,
    monthlyRevenue: formatCurrency(monthlyRevenueValue),
    totalOverdue: formatCurrency(totalOverdue),
    overdueStudentCount,
    todayClasses: todayClassesCount ?? 0,
  };
};

const Dashboard: React.FC = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: fetchDashboardStats,
    staleTime: 1000 * 60 * 10,
  });

  const { profile } = useSession();
  const isAdmin = profile?.role === "admin";

  const logoUrl =
    "https://nkwsvsmmzvukdghlyxpm.supabase.co/storage/v1/object/public/app-assets/atocalogo.png";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img src={logoUrl} alt="A Toca Pilates Logo" className="w-10 h-10 object-contain" />
          <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
        </div>
        <div className="text-sm text-muted-foreground">Bem-vindo de volta! 👋</div>
      </div>

      {isAdmin && <DataMigrationTool />}

      <PaymentDueAlert />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link to="/alunos?status=Ativo" className="block">
          <StatCard
            title="Alunos Ativos"
            value={stats?.activeStudents ?? 0}
            icon={<Users className="h-6 w-6" />}
            isLoading={isLoading}
            variant="bordered-green"
          />
        </Link>

        <Link to="/financeiro" className="block">
          <StatCard
            title="Receita do Mês"
            value={stats?.monthlyRevenue ?? formatCurrency(0)}
            icon={<DollarSign className="h-6 w-6" />}
            isLoading={isLoading}
            variant="bordered-green"
          />
        </Link>

        <Link to="/alunos?payment=Atrasado" className="block">
          <StatCard
            title="Alunos Inadimplentes"
            value={stats?.overdueStudentCount ?? 0}
            icon={<UserX className="h-6 w-6" />}
            isLoading={isLoading}
            variant="bordered-red"
          />
        </Link>

        <Link to="/agenda" className="block">
          <StatCard
            title="Aulas Hoje"
            value={stats?.todayClasses ?? 0}
            icon={<Calendar className="h-6 w-6" />}
            isLoading={isLoading}
            variant="bordered-yellow"
          />
        </Link>
      </div>

      <ColoredSeparator color="primary" className="my-8" />

      <div className="grid lg:grid-cols-2 gap-6">
        <UpcomingPaymentsCard />
        <BirthdayCard />
      </div>

      <ColoredSeparator color="accent" className="my-8" />
    </div>
  );
};

export default Dashboard;