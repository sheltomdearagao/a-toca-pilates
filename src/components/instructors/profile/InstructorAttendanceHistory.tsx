import React from 'react';
import { Calendar, Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import FinancialTableSkeleton from '@/components/financial/FinancialTableSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ClassEvent } from '@/types/schedule';
import { Link } from 'react-router-dom';

interface InstructorAttendanceHistoryProps {
  classesTaught: ClassEvent[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  isFetching: boolean;
  classCapacity: number;
}

const InstructorAttendanceHistory = ({ 
  classesTaught, 
  isLoading, 
  hasMore, 
  onLoadMore, 
  isFetching,
  classCapacity
}: InstructorAttendanceHistoryProps) => {

  // Sort classes by most recent first
  const sortedClasses = React.useMemo(() => {
    return [...classesTaught].sort((a, b) => 
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );
  }, [classesTaught]);

  if (isLoading) {
    return <FinancialTableSkeleton columns={4} rows={3} />;
  }

  return (
    <Card variant="bordered-yellow" className="lg:col-span-2 shadow-impressionist shadow-subtle-glow">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Calendar className="w-5 h-5 mr-2" /> 
          Histórico de Aulas Ministradas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedClasses.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aula</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Alunos</TableHead>
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedClasses.map((cls) => (
                  <TableRow 
                    key={cls.id} 
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <TableCell className="font-medium">
                      {cls.title}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(cls.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn(
                        cls.class_attendees?.[0]?.count >= classCapacity ? 'bg-red-500 text-white' :
                        cls.class_attendees?.[0]?.count > classCapacity / 2 ? 'bg-yellow-500 text-black' :
                        'bg-green-500 text-white'
                      )}>
                        {cls.class_attendees?.[0]?.count || 0}/{classCapacity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/agenda?classId=${cls.id}`} className="text-primary hover:underline text-sm">
                        Ver Aula
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Exibindo {sortedClasses.length} aulas.
              </p>
              {hasMore && (
                <Button 
                  variant="outline" 
                  onClick={onLoadMore} 
                  disabled={isFetching}
                  size="sm"
                >
                  {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Ver Mais"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4 opacity-50">🗓️</div>
            <p className="text-muted-foreground">Nenhuma aula encontrada para este instrutor.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstructorAttendanceHistory;