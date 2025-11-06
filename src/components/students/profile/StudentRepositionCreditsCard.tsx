import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, CalendarCheck, Minus, Plus } from 'lucide-react';
import { useRepositionCredits } from '@/hooks/useRepositionCredits';
import { Button } from '@/components/ui/button';
import { showError } from '@/utils/toast';

interface StudentRepositionCreditsCardProps {
  studentId: string | undefined;
  isAdmin: boolean;
}

const StudentRepositionCreditsCard = ({ studentId, isAdmin }: StudentRepositionCreditsCardProps) => {
  const { credits, isLoading, error, adjustCredit } = useRepositionCredits(studentId);

  if (!studentId) return null;

  const handleIncrement = () => {
    adjustCredit.mutate({ amount: 1, reason: 'Ajuste manual: +1' });
  };

  const handleDecrement = () => {
    if (credits > 0) {
      adjustCredit.mutate({ amount: -1, reason: 'Ajuste manual: -1' });
    } else {
      showError("O aluno não possui créditos para remover.");
    }
  };

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
              <div className="flex items-center justify-center gap-4">
                {isAdmin && (
                  <Button size="icon" variant="outline" onClick={handleDecrement} disabled={adjustCredit.isPending || credits <= 0}>
                    <Minus className="w-4 h-4" />
                  </Button>
                )}
                <p className="text-5xl font-bold text-primary">{credits}</p>
                {isAdmin && (
                  <Button size="icon" variant="outline" onClick={handleIncrement} disabled={adjustCredit.isPending}>
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-lg text-muted-foreground mt-2">Crédito(s) Disponível(is)</p>
            </div>
            
            <div className="flex items-center justify-center text-xs text-muted-foreground pt-2 border-t">
              <CalendarCheck className="w-4 h-4 mr-2" />
              <span>Créditos expiram no início do mês.</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentRepositionCreditsCard;