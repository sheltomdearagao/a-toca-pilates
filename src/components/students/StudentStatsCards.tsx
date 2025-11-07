import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import StatCard from '@/components/StatCard';
import { Users, UserCheck, UserMinus, UserX, AlertTriangle } from 'lucide-react';
import { StudentStatus } from '@/types/student';
import { Link } from 'react-router-dom';

interface StudentStats {
  Ativo: number;
  Experimental: number;
  Inativo: number;
  Bloqueado: number;
  Total: number;
}

const fetchStudentStats = async (): Promise<StudentStats> => {
  const { data: students, error } = await supabase
    .from('students')
    .select('status');

  if (error) throw new Error(error.message);

  const counts: Record<StudentStatus, number> = {
    'Ativo': 0,
    'Experimental': 0,
    'Inativo': 0,
    'Bloqueado': 0,
  } as Record<StudentStatus, number>;

  (students || []).forEach((s: any) => {
    if (s.status in counts) {
      counts[s.status as StudentStatus]++;
    }
  });

  return {
    ...counts,
    Total: (students || []).length,
  };
};

const StudentStatsCards = () => {
  const { data: stats, isLoading } = useQuery<StudentStats>({
    queryKey: ['studentStats'],
    queryFn: fetchStudentStats,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Link to="/alunos?status=Ativo" className="block">
        <StatCard
          title="Alunos Ativos"
          value={stats?.Ativo ?? 0}
          icon={<UserCheck className="h-6 w-6" />}
          isLoading={isLoading}
          variant="bordered-green"
        />
      </Link>

      <Link to="/alunos?status=Experimental" className="block">
        <StatCard
          title="Alunos Experimentais"
          value={stats?.Experimental ?? 0}
          icon={<AlertTriangle className="h-6 w-6" />}
          isLoading={isLoading}
          variant="bordered-yellow"
        />
      </Link>

      <Link to="/alunos?status=Inativo" className="block">
        <StatCard
          title="Alunos Inativos"
          value={stats?.Inativo ?? 0}
          icon={<UserMinus className="h-6 w-6" />}
          isLoading={isLoading}
          variant="bordered"
        />
      </Link>

      <Link to="/alunos?status=Bloqueado" className="block">
        <StatCard
          title="Alunos Bloqueados"
          value={stats?.Bloqueado ?? 0}
          icon={<UserX className="h-6 w-6" />}
          isLoading={isLoading}
          variant="bordered-red"
        />
      </Link>
    </div>
  );
};

export default StudentStatsCards;