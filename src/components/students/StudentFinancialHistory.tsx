import React, { useState } from 'react';
import { FinancialTransaction } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Loader2, MoreHorizontal, CheckCircle, Trash2, DollarSign, Calendar } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useStudentFinancialIntegration } from '@/hooks/useStudentFinancialIntegration';

interface StudentFinancialHistoryProps {
  transactions: FinancialTransaction[];
  isLoading: boolean;
  isAdminOrRecepcao: boolean;
  onMarkAsPaid: (transactionId: string) => void;
  onDeleteTransaction: (transaction: FinancialTransaction) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isFetching: boolean;
  studentId: string;
}

const StudentFinancialHistory = ({ 
  transactions, 
  isLoading, 
  isAdminOrRecepcao, 
  onMarkAsPaid, 
  onDeleteTransaction, 
  hasMore, 
  onLoadMore, 
  isFetching, 
  studentId 
}: StudentFinancialHistoryProps) => {
  const queryClient = useQueryClient();
  const { markTransactionAsPaid } = useStudentFinancialIntegration();

  const handleMarkAsPaid = (transactionId: string) => {
    // Pergunta quantos dias de validade adicionar
    const validityDays = prompt('Quantos dias de validade adicionar? (deixe vazio para não alterar)');
    
    if (validityDays !== null) {
      const days = validityDays.trim() ? parseInt(validityDays) : undefined;
      
      markTransactionAsPaid.mutate({
        transactionId,
        studentId,
        validityDays: days
      }, {
        onSuccess: () => {
          onMarkAsPaid(transactionId);
        }
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-impressionist shadow-subtle-glow">
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Histórico Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="bordered-green" className="lg:col-span-3 shadow-impressionist shadow-subtle-glow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Histórico Financeiro
          </span>
          <Badge variant="secondary">{transactions.length} lançamentos</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {isAdminOrRecepcao && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow 
                    key={transaction.id} 
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      transaction.status === 'Pago' && "bg-green-50/5",
                      transaction.status === 'Atrasado' && "bg-red-50/5",
                      transaction.status === 'Pendente' && "bg-yellow-50/5"
                    )}
                  >
                    <TableCell className="font-medium">
                      {transaction.description}
                      {transaction.is_recurring && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Recorrente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        transaction.status === 'Pago' ? 'payment-paid' :
                        transaction.status === 'Atrasado' ? 'payment-overdue' :
                        'payment-pending'
                      }>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transaction.due_date ? format(parseISO(transaction.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      {transaction.due_date && transaction.status === 'Pendente' && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {differenceInDays(new Date(), parseISO(transaction.due_date)) > 0 
                            ? `${differenceInDays(new Date(), parseISO(transaction.due_date))} dias atrasado`
                            : 'Em dia'
                          }
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-semibold",
                      transaction.type === 'revenue' ? "text-green-600" : "text-red-600"
                    )}>
                      {transaction.amount.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </TableCell>
                    {isAdminOrRecepcao && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {transaction.status !== 'Pago' && transaction.type === 'revenue' && (
                              <DropdownMenuItem onClick={() => handleMarkAsPaid(transaction.id)}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Marcar como Pago
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              className="text-destructive" 
                              onClick={() => onDeleteTransaction(transaction)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Exibindo {transactions.length} lançamentos.
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
            <div className="text-6xl mb-4 opacity-50">💰</div>
            <p className="text-muted-foreground">Nenhum lançamento financeiro encontrado.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {/* Abrir dialog de criar transação */}}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Criar Primeira Transação
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentFinancialHistory;