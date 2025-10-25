import React from 'react';
import { Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import FinancialTableSkeleton from '@/components/financial/FinancialTableSkeleton';
import { cn } from '@/lib/utils';

type ClassAttendance = {
  id: string;
  status: string;
  classes: {
    title: string;
    start_time: string;
  };
};

interface StudentAttendanceHistoryProps {
  attendance: ClassAttendance[];
  isLoading: boolean;
}

const StudentAttendanceHistory = ({ attendance, isLoading }: StudentAttendanceHistoryProps) => {
  return (
    <Card variant="bordered-yellow" className="lg:col-span-3 shadow-impressionist shadow-subtle-glow">
      <CardHeader>
        <CardTitle className="flex items-center"><Calendar className="w-5 h-5 mr-2" /> Histórico de Presença</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <FinancialTableSkeleton columns={3} rows={3} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aula</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.length > 0 ? attendance.map(a => (
                  <TableRow 
                    key={a.id} 
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      a.status === 'Presente' && "bg-green-50/5",
                      a.status === 'Faltou' && "bg-red-50/5",
                      a.status === 'Agendado' && "bg-blue-50/5"
                    )}
                  >
                    <TableCell>{a.classes.title}</TableCell>
                    <TableCell>{format(parseISO(a.classes.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell>
                      <Badge variant={
                        a.status === 'Presente' ? 'attendance-present' :
                        a.status === 'Faltou' ? 'attendance-absent' :
                        'attendance-scheduled'
                      }>{a.status}</Badge>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={3} className="text-center">Nenhum registro de presença.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-2">
              Exibindo os 10 registros mais recentes.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentAttendanceHistory;