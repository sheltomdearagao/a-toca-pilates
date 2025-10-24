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
import { Loader2, MoreHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import FinancialTableSkeleton from '@/components/financial/FinancialTableSkeleton'; // Reutilizando o skeleton de tabela
import { Badge } from '@/components/ui/badge'; // Importar Badge

interface StudentsTableProps {
  students: Student[] | undefined;
  isLoading: boolean;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
  paymentStatusMap: Record<string, 'Em Dia' | 'Atrasado'> | undefined; // Nova prop
}

const StudentsTable = React.memo(({ students, isLoading, onEdit, onDelete, paymentStatusMap }: StudentsTableProps) => {
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
    <Card className="shadow-subtle-glow">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Tipo Matrícula</TableHead>
            <TableHead>Status Aluno</TableHead>
            <TableHead>Status Pagamento</TableHead> {/* NOVA COLUNA */}
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
                  <Badge variant={
                    student.status === 'Ativo' ? 'status-active' :
                    student.status === 'Inativo' ? 'status-inactive' :
                    student.status === 'Experimental' ? 'status-experimental' :
                    'status-blocked'
                  }>
                    {student.status}
                  </Badge>
                </TableCell>
                <TableCell> {/* NOVA CÉLULA */}
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