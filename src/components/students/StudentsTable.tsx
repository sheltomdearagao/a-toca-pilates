import React from 'react';
import { Link } from 'react-router-dom';
import { Student } from '@/types/student';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Loader2, MoreHorizontal, CalendarPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import FinancialTableSkeleton from '@/components/financial/FinancialTableSkeleton';
import { Badge } from '@/components/ui/badge';

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface StudentsTableProps {
  students: Student[] | undefined;
  isLoading: boolean;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
  onScheduleClass: (student: Student) => void;
  paymentStatusMap: Record<string, 'Em Dia' | 'Atrasado'> | undefined;
}

const StudentsTable = React.memo(({ students, isLoading, onEdit, onDelete, onScheduleClass, paymentStatusMap }: StudentsTableProps) => {
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Student['status'] }) => {
      const { error } = await supabase.from('students').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      showSuccess('Status do aluno atualizado com sucesso!');
    },
    onError: (err: any) => {
      showError(err.message || 'Erro ao atualizar status.');
    },
  });

  if (isLoading) {
    return <FinancialTableSkeleton columns={6} rows={10} />;
  }

  if (!students || students.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-primary/50 shadow-subtle-glow">
        <Loader2 className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Nenhum aluno encontrado</h3>
        <p className="text-sm text-muted-foreground">Comece adicionando o primeiro aluno.</p>
      </Card>
    );
  }

  return (
    <Card className="shadow-impressionist shadow-subtle-glow">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Tipo Matrícula</TableHead>
            <TableHead>Status Aluno</TableHead>
            <TableHead>Status Pagamento</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => {
            const paymentStatus = paymentStatusMap?.[student.id] || 'Em Dia';
            
            return (
              <TableRow 
                key={student.id} 
                className="hover:bg-muted/50 transition-colors"
              >
                <TableCell className="font-medium">
                  <Link 
                    to={`/alunos/${student.id}`} 
                    className="hover:text-primary hover:underline transition-colors flex items-center"
                  >
                    {student.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    (student.plan_type === 'Mensal' ? "bg-primary/10 text-primary" :
                     student.plan_type === 'Trimestral' ? "bg-accent/10 text-accent" :
                     "bg-muted text-muted-foreground")
                  )}>
                    {student.plan_type !== 'Avulso' ? `${student.plan_type} ${student.plan_frequency}` : 'Avulso'}
                  </Badge>
                </TableCell>
                <TableCell>{student.enrollment_type}</TableCell>
                <TableCell>
                  {/* Inline status selector */}
                  <div className="max-w-[220px]">
                    <Select
                      onValueChange={(value) => {
                        if (value && value !== student.status) {
                          updateStatusMutation.mutate({ id: student.id, status: value as Student['status'] });
                        }
                      }}
                      value={student.status}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Experimental">Experimental</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                        <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                    {updateStatusMutation.isPending && <div className="text-xs text-muted-foreground mt-1">Atualizando...</div>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={
                    paymentStatus === 'Atrasado' ? 'payment-overdue' : 'payment-paid'
                  }>
                    {paymentStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onScheduleClass(student)}>
                        <CalendarPlus className="w-4 h-4 mr-2" /> Agendar Aula
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(student)}>
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive" 
                        onClick={() => onDelete(student)}
                      >
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
});

export default StudentsTable;