import { FinancialTransaction } from "@/types/financial";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, MoreHorizontal, Repeat, CheckCircle, Edit, Trash2, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import React from "react";
import FinancialTableSkeleton from "./FinancialTableSkeleton";

interface AllTransactionsTableProps {
  transactions: FinancialTransaction[] | undefined;
  isLoading: boolean;
  formatCurrency: (value: number) => string;
  onEdit: (transaction: FinancialTransaction) => void;
  onDelete: (transaction: FinancialTransaction) => void;
  onMarkAsPaid: (transactionId: string) => void;
}

const AllTransactionsTable = ({
  transactions,
  isLoading,
  formatCurrency,
  onEdit,
  onDelete,
  onMarkAsPaid,
}: AllTransactionsTableProps) => {
  if (isLoading) {
    return <FinancialTableSkeleton columns={8} rows={10} />;
  }

  return (
    <div className="bg-card rounded-lg border shadow-impressionist shadow-subtle-glow">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Aluno</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions?.map((t) => (
            <TableRow 
              key={t.id} 
              className={cn(
                "hover:bg-muted/50 transition-colors",
                t.type === 'revenue' && "bg-green-50/5",
                t.type === 'expense' && "bg-red-50/5"
              )}
            >
              <TableCell className="font-medium flex items-center">
                {t.description}
                {t.is_recurring && (
                  <Repeat className="w-4 h-4 ml-2 text-muted-foreground" />
                )}
              </TableCell>
              <TableCell>{t.type === 'revenue' ? 'Receita' : 'Despesa'}</TableCell>
              <TableCell>{t.category}</TableCell>
              <TableCell>{t.students?.name || '-'}</TableCell>
              <TableCell>{t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy') : '-'}</TableCell>
              <TableCell>
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  t.status === 'Pago' && "bg-green-100 text-green-800",
                  t.status === 'Atrasado' && "bg-red-100 text-red-800",
                  t.status === 'Pendente' && "bg-yellow-100 text-yellow-800"
                )}>
                  {t.status || '-'}
                </span>
              </TableCell>
              <TableCell className={cn(
                "text-right font-bold",
                t.type === 'revenue' ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(t.amount)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Abrir menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(t)}>
                      <Edit className="w-4 h-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    {t.status !== 'Pago' && t.type === 'revenue' && (
                      <DropdownMenuItem onClick={() => onMarkAsPaid(t.id)}>
                        <DollarSign className="w-4 h-4 mr-2" /> Marcar como Pago
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      className="text-destructive" 
                      onClick={() => onDelete(t)}
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
    </div>
  );
};

export default AllTransactionsTable;