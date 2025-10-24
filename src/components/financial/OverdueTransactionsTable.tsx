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
import { Loader2, MoreHorizontal, CheckCircle, Phone } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import React from "react";
import FinancialTableSkeleton from "./FinancialTableSkeleton"; // Importar o Skeleton
import { showSuccess, showError } from "@/utils/toast"; // Importar toasts

interface OverdueTransactionsTableProps {
  overdueTransactions: FinancialTransaction[] | undefined;
  isLoading: boolean;
  formatCurrency: (value: number) => string;
  onMarkAsPaid: (transactionId: string) => void;
}

const OverdueTransactionsTable = ({
  overdueTransactions,
  isLoading,
  formatCurrency,
  onMarkAsPaid,
}: OverdueTransactionsTableProps) => {
  if (isLoading) {
    return <FinancialTableSkeleton columns={6} rows={3} />;
  }

  const handleCopyPhone = (phone: string | null | undefined) => {
    if (phone) {
      navigator.clipboard.writeText(phone);
      showSuccess(`Telefone (${phone}) copiado para a área de transferência!`);
    } else {
      showError("Telefone não disponível para este aluno.");
    }
  };

  return (
    <div className="bg-card rounded-lg border shadow-impressionist shadow-subtle-glow">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Dias Atrasado</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {overdueTransactions?.map((t) => (
            <TableRow key={t.id} className="bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              <TableCell className="font-medium">{t.students?.name || 'N/A'}</TableCell>
              <TableCell>{t.description}</TableCell>
              <TableCell>{t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy') : '-'}</TableCell>
              <TableCell>{t.due_date ? differenceInDays(new Date(), parseISO(t.due_date)) : '-'}</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(t.amount)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Abrir menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onMarkAsPaid(t.id)}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Pago
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyPhone(t.students?.phone)}>
                      <Phone className="w-4 h-4 mr-2" /> Copiar Telefone
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

export default OverdueTransactionsTable;