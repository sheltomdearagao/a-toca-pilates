import { Cake, User, Gift, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, getDate, parseISO } from "date-fns";
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

type BirthdayStudent = {
  id: string;
  name: string;
  date_of_birth: string;
  phone: string | null;
};

const fetchBirthdayStudents = async (): Promise<BirthdayStudent[]> => {
  const currentMonth = new Date().getMonth() + 1;
  
  // Usando a nova função DB para buscar aniversariantes com dados de perfil
  const { data, error } = await supabase.rpc('get_birthday_students_for_month', {
    p_month: currentMonth
  });

  if (error) {
    console.error("Erro ao buscar aniversariantes:", error);
    throw new Error(error.message);
  }
  return (data as BirthdayStudent[]) || [];
};

const BirthdayCard = () => {
  const { data: students, isLoading } = useQuery<BirthdayStudent[]>({
    queryKey: ['birthdayStudents'],
    queryFn: fetchBirthdayStudents,
    staleTime: 1000 * 60 * 10, // Cache por 10 minutos
  });

  const birthdaysThisMonth = students?.sort((a, b) => {
    const dateA = getDate(parseISO(a.date_of_birth));
    const dateB = getDate(parseISO(b.date_of_birth));
    return dateA - dateB;
  });

  return (
    <div className="space-y-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center text-lg">
          <Gift className="w-5 h-5 mr-2 text-accent" />
          Aniversariantes do Mês
        </CardTitle>
        <div className="flex items-center text-sm text-muted-foreground">
          <Cake className="w-4 h-4 mr-1" />
          {isLoading ? <Skeleton className="h-4 w-8" /> : `${birthdaysThisMonth?.length || 0} aniversários`}
        </div>
      </CardTitle>
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
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border bg-secondary/20 transition-colors duration-200",
                  "hover:bg-secondary/40 hover:scale-[1.01] hover:shadow-subtle-glow"
                )}
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
                      <span>
                        {format(parseISO(student.date_of_birth), 'dd \'de\' MMMM', { locale: ptBR })}
                      </span>
                      {student.phone && (
                        <span className="flex items-center">
                          <Phone className="w-3 h-3 mr-1.5" />
                          {student.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-2xl">
                  🎉
                </div>
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
    </div>
  );
};

export default BirthdayCard;