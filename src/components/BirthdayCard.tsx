import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Cake, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, getMonth, getDate, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Definindo um tipo mais específico para os dados de aniversariantes
type BirthdayStudent = {
  id: string;
  name: string;
  date_of_birth: string; // Assumimos que date_of_birth não será nulo aqui devido à query
};

const fetchBirthdayStudents = async (): Promise<BirthdayStudent[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, date_of_birth')
    .not('date_of_birth', 'is', null); // Only fetch students with a birth date
  if (error) throw new Error(error.message);
  // O cast é seguro aqui porque a query seleciona exatamente os campos de BirthdayStudent
  return (data as BirthdayStudent[]) || [];
};

const BirthdayCard = () => {
  const { data: students, isLoading } = useQuery<BirthdayStudent[]>({
    queryKey: ['birthdayStudents'],
    queryFn: fetchBirthdayStudents,
  });

  const currentMonth = getMonth(new Date()); // 0-indexed month

  const birthdaysThisMonth = students?.filter(student => {
    // date_of_birth já é garantido como não nulo pela query
    const dob = parseISO(student.date_of_birth);
    return getMonth(dob) === currentMonth;
  }).sort((a, b) => {
    const dateA = getDate(parseISO(a.date_of_birth));
    const dateB = getDate(parseISO(b.date_of_birth));
    return dateA - dateB;
  });

  return (
    <div className="col-span-full lg:col-span-2"> {/* Removido Card e shadow-impressionist daqui, pois será aplicado no pai */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Aniversariantes do Mês</CardTitle>
        <Cake className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ) : birthdaysThisMonth && birthdaysThisMonth.length > 0 ? (
          <ul className="space-y-2">
            {birthdaysThisMonth.map(student => (
              <li key={student.id} className="flex items-center text-sm p-2 rounded-md hover:bg-accent transition-colors"> {/* Adicionado hover e padding */}
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{student.name} - {format(parseISO(student.date_of_birth), 'dd/MM', { locale: ptBR })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground p-2">Nenhum aniversariante este mês.</p>
        )}
      </CardContent>
    </div>
  );
};

export default BirthdayCard;