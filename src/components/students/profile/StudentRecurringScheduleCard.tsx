import React from 'react';
import { Student } from '@/types/student';
import { RecurringClassTemplate } from '@/types/schedule';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Repeat, Calendar, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ColoredSeparator } from '@/components/ColoredSeparator';
import { format, parseISO } from 'date-fns';

interface StudentRecurringScheduleCardProps {
  student: Student | undefined;
  recurringTemplate: RecurringClassTemplate | null | undefined;
  isLoading: boolean;
}

const DAYS_OF_WEEK_MAP: { [key: string]: string } = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

const StudentRecurringScheduleCard = ({ student, recurringTemplate, isLoading }: StudentRecurringScheduleCardProps) => {
  // preferredDaysDisplay e preferredTimeDisplay removidos, pois os campos foram removidos do Student
  
  return (
    <Card variant="bordered-yellow" className="lg:col-span-2 shadow-impressionist shadow-subtle-glow">
      <CardHeader>
        <CardTitle className="flex items-center"><Repeat className="w-5 h-5 mr-2" /> Agendamento Recorrente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : student?.plan_type === 'Avulso' ? (
          <p className="text-muted-foreground">Este aluno possui plano Avulso e não tem agendamento recorrente.</p>
        ) : (
          <>
            {/* Removido a exibição de Dias e Horários Preferidos */}
            
            {/* <ColoredSeparator color="yellow" className="my-2" /> */}

            {recurringTemplate ? (
              <div className="space-y-2">
                <p className="font-semibold text-primary">Modelo Recorrente Ativo:</p>
                <p>Título: {recurringTemplate.title}</p>
                <p>Duração: {recurringTemplate.duration_minutes} minutos</p>
                <p>Início: {format(parseISO(recurringTemplate.recurrence_start_date), 'dd/MM/yyyy')}</p>
                {recurringTemplate.recurrence_pattern && (
                  <div className="mt-2">
                    <p className="font-medium">Padrão:</p>
                    {recurringTemplate.recurrence_pattern.map((p, index) => (
                      <Badge key={index} variant="secondary" className="mr-2 mt-1">
                        {DAYS_OF_WEEK_MAP[p.day]} às {p.time}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum modelo de aula recorrente ativo. Use o botão 'Gerenciar Recorrência' para configurar.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentRecurringScheduleCard;