import React from 'react';
import { Instructor } from '@/types/instructor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StickyNote, Mail, Phone, Cake, Home, DollarSign } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/formatters';

interface InstructorDetailsCardProps {
  instructor: Instructor | undefined;
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

const InstructorDetailsCard = ({ instructor, isLoading }: InstructorDetailsCardProps) => {
  return (
    <Card variant="bordered" className="lg:col-span-2 shadow-impressionist shadow-subtle-glow">
      <CardHeader>
        <CardTitle className="flex items-center"><StickyNote className="w-5 h-5 mr-2" /> Detalhes do Instrutor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <div className="flex items-center">
              <Mail className="w-4 h-4 mr-3 text-muted-foreground" />
              <span>{instructor?.email || 'Não informado'}</span>
            </div>
            <div className="flex items-center">
              <Phone className="w-4 h-4 mr-3 text-muted-foreground" />
              <span>{instructor?.phone || 'Não informado'}</span>
            </div>
            <div className="flex items-center">
              <Home className="w-4 h-4 mr-3 text-muted-foreground" />
              <span>{instructor?.address || 'Não informado'}</span>
            </div>
            {instructor?.date_of_birth && (
              <div className="flex items-center">
                <Cake className="w-4 h-4 mr-3 text-muted-foreground" />
                <span>{format(parseISO(instructor.date_of_birth), 'dd/MM/yyyy', { locale: ptBR })}</span>
              </div>
            )}
            {instructor?.hourly_rate && (
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 mr-3 text-muted-foreground" />
                <span>Valor Hora: {formatCurrency(instructor.hourly_rate)}</span>
              </div>
            )}
            {instructor?.notes && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground">{instructor.notes}</p>
              </div>
            )}
            {instructor?.working_days && instructor.working_days.length > 0 && (
              <div className="pt-2 border-t">
                <p className="font-medium mb-2">Dias e Horários de Trabalho:</p>
                <div className="flex flex-wrap gap-2">
                  {instructor.working_days.map((day, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {DAYS_OF_WEEK_MAP[day.day]} ({day.start_time}-{day.end_time})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default InstructorDetailsCard;