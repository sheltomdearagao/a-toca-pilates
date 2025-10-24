import React from 'react';
import { FinancialTransaction } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { DollarSign, MoreHorizontal, CheckCircle, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import FinancialTableSkeleton from '@/components/financial/FinancialTableSkeleton';
import { formatCurrency } from "@/utils/formatters";
import { cn } from '@/lib/utils';

interface StudentFinancialHistoryProps {
  transactions: FinancialTransaction[];
  isLoading: boolean;
  isAdmin: boolean;
  onMarkAsPaid: (transactionId: string) => void;
  onDeleteTransaction: (transaction: FinancialTransaction) => void;
}

const StudentFinancialHistory = ({
  transactions,
  isLoading,
  isAdmin,
  onMarkAsPaid,
  onDeleteTransaction,
}: StudentFinancialHistoryProps) => {
  return (
    <Card variant="bordered-green" className="lg:col-span-3 shadow-impressionist shadow-subtle-glow">
      <CardHeader>
        <CardTitle className="flex items-center"><DollarSign className="w-5 h-5 mr-2" /> Histórico Financeiro</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <FinancialTableSkeleton columns={5} rows={3} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length > 0 ? transactions.map(t => (
                <TableRow 
                  key={t.id} 
                  className={cn(
                    "hover:bg-muted/50 transition-colors",
                    t.status === 'Pago' && "bg-green-50/5",
                    t.status === 'Atrasado' && "bg-red-50/5",
                    t.status === 'Pendente' && "bg-yellow-50/5"
                  )}
                >
                  <TableCell>{t.description}</TableCell>
                  <TableCell>
                    <Badge variant={
                      t.status === 'Pago' ? 'payment-paid' :
                      t.status === 'Atrasado' ? 'payment-overdue' :
                      'payment-pending'
                    }>{t.status}</Badge>
                  </TableCell>
                  <TableCell>{t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(t.amount)}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {t.status !== 'Pago' && t.type === 'revenue' && (
                            <DropdownMenuItem onClick={() => onMarkAsPaid(t.id)}>
                              <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Pago
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => onDeleteTransaction(t)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center">Nenhum lançamento financeiro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentFinancialHistory;