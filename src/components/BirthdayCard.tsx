import { Cake, User, Gift, Phone, UserCog } from "lucide-react"; // Adicionado UserCog
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, getDate } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useMemo } from "react";

type BirthdayPerson = { // Renomeado para ser mais genérico
  id: string;
  name: string;
  date_of_birth: string;
  phone: string | null;
  type: 'student' | 'instructor'; // Adicionado o campo 'type'
};

const fetchBirthdayStudents = async (): Promise<BirthdayPerson[]> => {
  console.log('🎂 [BIRTHDAY] Iniciando busca de aniversariantes via RPC...');
  
  const currentMonth = new Date().getMonth() + 1; // 1-12
  
  // Chama a função RPC existente no Supabase
  const { data, error } = await supabase.rpc('get_birthday_students_for_month', {
    p_month: currentMonth,
  });

  if (error) {
    console.error('❌ [BIRTHDAY] Erro na consulta RPC:', error);
    throw new Error(error.message);
  }

  console.log('✅ [BIRTHDAY] Total de aniversariantes encontrados:', data?.length || 0);

  // O RPC retorna todos os alunos com data de nascimento no mês atual, não apenas ativos.
  return (data || []) as BirthdayPerson[];
};

const BirthdayCard = () => {
  const { data: people, isLoading, error } = useQuery<BirthdayPerson[]>({ // Renomeado para 'people'
    queryKey: ["birthdayStudents"],
    queryFn: fetchBirthdayStudents,
    staleTime: 1000 * 60 * 5,
  });

  const birthdaysThisMonth = useMemo(() => {
    if (!people) return [];
    
    return people
      .slice()
      .sort((a, b) => {
        // Ordena pelo dia do mês
        const dateA = parseISO(a.date_of_birth);
        const dateB = parseISO(b.date_of_birth);
        
        const dayA = getDate(dateA);
        const dayB = getDate(dateB);
        
        return dayA - dayB;
      });
  }, [people]);

  if (error) {
    console.error("Erro ao carregar aniversariantes:", error);
    return (
      <Card className="shadow-impressionist shadow-subtle-glow border-l-4 border-destructive">
        <CardHeader><CardTitle className="text-lg text-destructive">Erro ao Carregar Aniversariantes</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Verifique o console para detalhes do erro.</p></CardContent>
      </Card>
    );
  }

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
            {birthdaysThisMonth.map((person) => (
              <div
                key={person.id}
                className="flex items-center justify-between p-4 rounded-xl border bg-secondary/20 transition-colors duration-200 hover:bg-secondary/40 hover:shadow-subtle-glow"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary rounded-lg">
                    {person.type === 'instructor' ? (
                      <UserCog className="w-4 h-4 text-white" />
                    ) : (
                      <User className="w-4 h-4 text-white" />
                    )}
                  </div>

                  <div>
                    <Link 
                      to={person.type === 'instructor' ? `/instrutores/${person.id}` : `/alunos/${person.id}`} 
                      className="font-medium hover:underline hover:text-primary"
                    >
                      {person.name}
                    </Link>

                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                      <span>{format(parseISO(person.date_of_birth), "dd 'de' MMMM", { locale: ptBR })}</span>
                      {person.phone && (
                        <span className="flex items-center">
                          <Phone className="w-3 h-3 mr-1.5" />
                          {person.phone}
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