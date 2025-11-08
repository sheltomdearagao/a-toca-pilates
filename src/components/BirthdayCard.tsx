import { Cake, User, Gift, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, getDate } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

type BirthdayStudent = {
  id: string;
  name: string;
  date_of_birth: string;
  phone: string | null;
};

const fetchBirthdayStudents = async (): Promise<BirthdayStudent[]> => {
  console.log('🎂 [BIRTHDAY] Iniciando busca de aniversariantes...');
  
  // Busca TODOS os alunos ativos
  const { data: allStudents, error } = await supabase
    .from("students")
    .select("id, name, date_of_birth, phone, status")
    .eq("status", "Ativo");

  console.log('📊 [BIRTHDAY] Total de alunos ativos:', allStudents?.length || 0);

  if (error) {
    console.error('❌ [BIRTHDAY] Erro na consulta:', error);
    throw new Error(error.message);
  }

  // Filtra no cliente
  const currentMonth = new Date().getMonth(); // 0-11
  const currentYear = new Date().getFullYear();
  
  console.log('📅 [BIRTHDAY] Mês/Ano atual:', { currentMonth: currentMonth + 1, currentYear });
  
  const list = (allStudents || []).filter((s: any) => {
    // Ignora alunos sem data de nascimento
    if (!s.date_of_birth) {
      console.log(`⚠️ [BIRTHDAY] ${s.name} não tem data de nascimento`);
      return false;
    }
    
    try {
      const dob = parseISO(s.date_of_birth);
      const studentMonth = dob.getMonth();
      const matches = studentMonth === currentMonth;
      
      console.log(`${matches ? '✅' : '❌'} [BIRTHDAY] ${s.name}:`, {
        date_of_birth: s.date_of_birth,
        studentMonth: studentMonth + 1,
        currentMonth: currentMonth + 1,
        matches
      });
      
      return matches;
    } catch (err) {
      console.error(`❌ [BIRTHDAY] Erro ao processar ${s.name}:`, err);
      return false;
    }
  });

  console.log('✅ [BIRTHDAY] Total de aniversariantes encontrados:', list.length);

  return list as BirthdayStudent[];
};

const BirthdayCard = () => {
  const { data: students, isLoading, error } = useQuery<BirthdayStudent[]>({
    queryKey: ["birthdayStudents"],
    queryFn: fetchBirthdayStudents,
    staleTime: 1000 * 60 * 5,
  });

  console.log('🔄 [BIRTHDAY] Estado da query:', {
    data: students,
    isLoading,
    error,
    dataLength: students?.length
  });

  const birthdaysThisMonth = (students ?? [])
    .slice()
    .sort((a, b) => {
      const dateA = getDate(parseISO(a.date_of_birth));
      const dateB = getDate(parseISO(b.date_of_birth));
      return dateA - dateB;
    });

  return (
    <Card className="shadow-impressionist shadow-subtle-glow">
      <CardHeader className="flex items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center text-lg">
          <Gift className="w-5 h-5 mr-2 text-accent" />
          Aniversariantes do Mês
        </CardTitle>

        <div className="flex items-center text-sm text-muted-foreground">
          <Cake className="w-4 h-4 mr-1" />
          {isLoading ? <Skeleton className="h-4 w-8" /> : `${birthdaysThisMonth?.length ?? 0} aniversários`}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-1/2" />
          </div>
        ) : birthdaysThisMonth && birthdaysThisMonth.length > 0 ? (
          <div className="space-y-3">
            {birthdaysThisMonth.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-4 rounded-xl border bg-secondary/20 transition-colors duration-200 hover:bg-secondary/40 hover:shadow-subtle-glow"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary rounded-lg">
                    <User className="w-4 h-4 text-white" />
                  </div>

                  <div>
                    <Link to={`/alunos/${student.id}`} className="font-medium text-foreground hover:underline hover:text-primary">
                      {student.name}
                    </Link>

                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                      <span>{format(parseISO(student.date_of_birth), "dd 'de' MMMM", { locale: ptBR })}</span>
                      {student.phone && (
                        <span className="flex items-center">
                          <Phone className="w-3 h-3 mr-1.5" />
                          {student.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-2xl">🎉</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4 opacity-50">🎂</div>
            <p className="text-muted-foreground">Nenhum aniversariante este mês</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BirthdayCard;