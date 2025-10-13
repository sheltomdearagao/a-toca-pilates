import { Cake, User, Gift } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, getMonth, getDate, parseISO } from "date-fns";
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type BirthdayStudent = {
  id: string;
  name: string;
  date_of_birth: string;
};

const fetchBirthdayStudents = async (): Promise<BirthdayStudent[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, date_of_birth')
    .not('date_of_birth', 'is', null);
  if (error) throw new Error(error.message);
  return (data as BirthdayStudent[]) || [];
};

const BirthdayCard = () => {
  const { data: students, isLoading } = useQuery<BirthdayStudent[]>({
    queryKey: ['birthdayStudents'],
    queryFn: fetchBirthdayStudents,
  });

  const currentMonth = getMonth(new Date());

  const birthdaysThisMonth = students?.filter(student => {
    const dob = parseISO(student.date_of_birth);
    return getMonth(dob) === currentMonth;
  }).sort((a, b) => {
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
          {birthdaysThisMonth?.length || 0} aniversários
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
            {birthdaysThisMonth.map((student, index) => (
              <div
                key={student.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border bg-gradient-to-r from-accent/5 to-primary/5 hover:from-accent/10 hover:to-primary/10 transition-all duration-300 hover:scale-102 hover:shadow-md animate-slide-in",
                  `animation-delay-${index * 100}`
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-accent to-primary rounded-lg">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{student.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(student.date_of_birth), 'dd \'de\' MMMM', { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="text-2xl animate-float">
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