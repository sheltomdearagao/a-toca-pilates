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
import { Loader2, MoreHorizontal, CheckCircle, Edit, Trash2, ArrowUpDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from 'date-fns/locale/pt-BR';
import React from "react";
import FinancialTableSkeleton from "./FinancialTableSkeleton"; // Importar o Skeleton
import { showSuccess, showError } from "@/utils/toast";

interface AllTransactionsTableProps {
  transactions: FinancialTransaction[] | undefined;
  isLoading: boolean;
  formatCurrency: (value: number) => string;
  onEdit: (transaction: FinancialTransaction) => void;
  onDelete: (transaction: FinancialTransaction) => void;
  onMarkAsPaid: (transactionId: string) => void;
  sortColumn: keyof FinancialTransaction;
  sortDirection: 'asc' | 'desc';
  onSort: (column: keyof FinancialTransaction) => void;
}

const AllTransactionsTable = ({
  transactions,
  isLoading,
  formatCurrency,
  onEdit,
  onDelete,
  onMarkAsPaid,
  sortColumn,
  sortDirection,
  onSort,
}: AllTransactionsTableProps) => {
  if (isLoading) {
    return <FinancialTableSkeleton columns={6} rows={3} />;
  }

  const handleSort = (column: keyof FinancialTransaction) => {
    onSort(column);
  };

  return (
    <div className="bg-card rounded-lg border shadow-impressionist shadow-subtle-glow">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('description')}
            >
              Descrição {sortColumn === 'description' && <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection}`} />}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('type')}
            >
              Tipo {sortColumn === 'type' && <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection}`} />}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('category')}
            >
              Categoria {sortColumn === 'category' && <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection}`} />}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('status')}
            >
              Status {sortColumn === 'status' && <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection}`} />}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('due_date')}
            >
              Vencimento {sortColumn === 'due_date' && <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection}`} />}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 text-right"
              onClick={() => handleSort('amount')}
            >
              Valor {sortColumn === 'amount' && <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection}`} />}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 text-right"
              onClick={() => handleSort('created_at')}
            >
              Data de Lançamento {sortColumn === 'created_at' && <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection}`} />}
            </TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions?.map((t) => (
            <TableRow key={t.id} className="bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              <TableCell className="font-medium">{t.description}</TableCell>
              <TableCell>{t.type === 'revenue' ? 'Receita' : 'Despesa'}</TableCell>
              <TableCell>{t.category}</TableCell>
              <TableCell>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  t.status === 'Pago' ? 'bg-green-100 text-green-800' :
                  t.status === 'Atrasado' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {t.status}
                </span>
              </TableCell>
              <TableCell>{t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</TableCell>
              <TableCell className="text-right font-bold">
                {formatCurrency(t.amount)}
              </TableCell>
              <TableCell className="text-right font-bold">
                {format(parseISO(t.created_at), 'dd/MM/yyyy', { locale: ptBR })}
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
                        <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Pago
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