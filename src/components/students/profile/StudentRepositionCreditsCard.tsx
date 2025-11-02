import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, CalendarCheck } from 'lucide-react';
import { useRepositionCredits } from '@/hooks/useRepositionCredits';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

interface StudentRepositionCreditsCardProps {
  studentId: string | undefined;
}

const StudentRepositionCreditsCard = ({ studentId }: StudentRepositionCreditsCardProps) => {
  const { credits, isLoading, error } = useRepositionCredits(studentId);

  if (!studentId) return null;

  return (
    <Card variant="bordered-blue" className="lg:col-span-1 shadow-impressionist shadow-subtle-glow">
      <CardHeader>
        <CardTitle className="flex items-center"><RefreshCw className="w-5 h-5 mr-2" /> Créditos de Reposição</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : error ? (
          <p className="text-destructive">Erro ao carregar créditos.</p>
        ) : (
          <>
            <div className="text-center">
              <p className="text-5xl font-bold text-primary">{credits}</p>
              <p className="text-lg text-muted-foreground">Crédito(s) Disponível(is)</p>
            </div>
            
            <div className="flex items-center justify-center text-xs text-muted-foreground pt-2 border-t">
              <CalendarCheck className="w-4 h-4 mr-2" />
              <span>Renovação automática no início do mês.</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentRepositionCreditsCard;