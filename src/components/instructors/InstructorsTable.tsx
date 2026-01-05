import React from 'react';
import { Instructor } from '@/types/instructor';
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
import { Loader2, MoreHorizontal, Edit, Trash2, DollarSign, CalendarDays } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import FinancialTableSkeleton from '@/components/financial/FinancialTableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom'; // Importar Link

interface InstructorsTableProps {
  instructors: Instructor[] | undefined;
  isLoading: boolean;
  onEdit: (instructor: Instructor) => void;
  onDelete: (instructor: Instructor) => void;
  onLaunchPayment: (instructor: Instructor) => void;
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

const InstructorsTable = React.memo(({ instructors, isLoading, onEdit, onDelete, onLaunchPayment }: InstructorsTableProps) => {
  if (isLoading) {
    return <FinancialTableSkeleton columns={6} rows={5} />;
  }

  if (!instructors || instructors.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-primary/50 shadow-subtle-glow">
        <Loader2 className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Nenhum instrutor encontrado</h3>
        <p className="text-sm text-muted-foreground">Comece adicionando o primeiro instrutor.</p>
      </Card>
    );
  }

  return (
    <Card className="shadow-impressionist shadow-subtle-glow">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dias de Trabalho</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instructors.map((instructor) => (
            <TableRow key={instructor.id} className="hover:bg-muted/50 transition-colors">
              <TableCell className="font-medium">
                <Link 
                  to={`/instrutores/${instructor.id}`} 
                  className="hover:text-primary hover:underline transition-colors flex items-center"
                >
                  {instructor.name}
                </Link>
              </TableCell>
              <TableCell>{instructor.email || '-'}</TableCell>
              <TableCell>{instructor.phone || '-'}</TableCell>
              <TableCell>
                <Badge variant={
                  instructor.status === 'Ativo' ? 'status-active' :
                  instructor.status === 'Inativo' ? 'status-inactive' :
                  'status-experimental' // Usando experimental para férias
                }>
                  {instructor.status}
                </Badge>
              </TableCell>
              <TableCell>
                {instructor.working_days && instructor.working_days.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {instructor.working_days.map((day, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {DAYS_OF_WEEK_MAP[day.day]} ({day.start_time}-{day.end_time})
                      </Badge>
                    ))}
                  </div>
                ) : (
                  '-'
                )}
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
                    <DropdownMenuItem onClick={() => onEdit(instructor)}>
                      <Edit className="w-4 h-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onLaunchPayment(instructor)}>
                      <DollarSign className="w-4 h-4 mr-2" /> Lançar Pagamento
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(instructor)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
});

export default InstructorsTable;