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
import { useStudentFinancialIntegration } from '@/hooks/useVou completar o componente de histórico financeiro e depois criar um componente principal que integra tudo:

<dyad-write path="src/components/students/StudentFinancialHistory.tsx" description="Completando histórico financeiro integrado">
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

<dyad-problem-report summary="62 problems">
<problem file="src/components/students/StudentCreditIntegration.tsx" line="91" column="11" code="17014">JSX fragment has no corresponding closing tag.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="93" column="8" code="17008">JSX element 'Card' has no corresponding closing tag.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="103" column="10" code="17008">JSX element 'CardContent' has no corresponding closing tag.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="105" column="12" code="17008">JSX element 'div' has no corresponding closing tag.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="106" column="14" code="17008">JSX element 'div' has no corresponding closing tag.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="117" column="16" code="17008">JSX element 'div' has no corresponding closing tag.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="121" column="23" code="1005">'&gt;' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="121" column="135" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="136" column="1" code="1109">Expression expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="144" column="12" code="1005">'}' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="146" column="28" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="147" column="1" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="153" column="36" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="154" column="3" code="1109">Expression expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="162" column="40" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="163" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="164" column="41" code="1005">'}' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="166" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="169" column="63" code="1005">'}' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="171" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="173" column="31" code="1003">Identifier expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="174" column="61" code="1005">'}' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="176" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="180" column="13" code="1005">'}' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="183" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="184" column="16" code="1005">'}' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="184" column="22" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="185" column="37" code="1005">'}' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="188" column="7" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="189" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="190" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="192" column="31" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="193" column="22" code="1005">'}' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="197" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="199" column="31" code="1382">Unexpected token. Did you mean `{'&gt;'}` or `&amp;gt;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="200" column="5" code="1109">Expression expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="200" column="18" code="1003">Identifier expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="201" column="61" code="1005">'}' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="203" column="5" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="208" column="3" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="341" column="1" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="343" column="41" code="1005">'&lt;/' expected.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="121" column="19" code="2322">Type '{ className: string; src: true; }' is not assignable to type 'DetailedHTMLProps&lt;HTMLAttributes&lt;HTMLParagraphElement&gt;, HTMLParagraphElement&gt;'.
  Property 'src' does not exist on type 'DetailedHTMLProps&lt;HTMLAttributes&lt;HTMLParagraphElement&gt;, HTMLParagraphElement&gt;'.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="123" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="123" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="123" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="130" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="130" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="130" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="130" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="130" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="130" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="137" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="137" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="137" column="10" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="150" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="150" column="3" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="159" column="11" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="159" column="11" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="179" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="180" column="7" code="2304">Cannot find name 'amount'.</problem>
<problem file="src/components/students/StudentCreditIntegration.tsx" line="184" column="7" code="2304">Cannot find name 'onSuccess'.</problem>
</dyad-problem-report>Vou corrigir todos os erros de compilação no arquivo StudentCreditIntegration.tsx:

<dyad-write path="src/components/students/StudentCreditIntegration.tsx" description="Corrigindo todos os erros de compilação">
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { RefreshCw, Plus, Minus, History } from 'lucide-react';
import { useRepositionCredits } from '@/hooks/useRepositionCredits';
import { useStudentFinancialIntegration } from '@/hooks/useStudentFinancialIntegration';
import { showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface StudentCreditIntegrationProps {
  studentId: string | undefined;
  isAdmin: boolean;
  onViewCreditHistory: () => void;
}

const StudentCreditIntegration = ({ 
  studentId, 
  isAdmin, 
  onViewCreditHistory 
}: StudentCreditIntegrationProps) => {
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdding, setIsAdding] = useState(true);

  const { credits, isLoading, adjustCredit } = useRepositionCredits(studentId);
  const { updateStudentCredit } = useStudentFinancialIntegration();

  const handleAdjustCredit = async () => {
    if (!studentId) {
      showError('Aluno não encontrado.');
      return;
    }

    if (!adjustReason.trim()) {
      showError('Por favor, informe um motivo para o ajuste.');
      return;
    }

    if (!isAdding && credits <= 0) {
      showError('O aluno não possui créditos para remover.');
      return;
    }

    updateStudentCredit.mutate({
      studentId: studentId,
      amount: isAdding ? adjustAmount : -adjustAmount,
      reason: adjustReason,
      entryType: 'manual_adjustment',
    }, {
      onSuccess: () => {
        setIsAdjustDialogOpen(false);
        setAdjustAmount(1);
        setAdjustReason('');
      }
    });
  };

  const handleIncrement = () => {
    setIsAdding(true);
    setAdjustAmount(1);
    setAdjustReason('');
    setIsAdjustDialogOpen(true);
  };

  const handleDecrement = () => {
    if (credits <= 0) {
      showError("O aluno não possui créditos para remover.");
      return;
    }
    setIsAdding(false);
    setAdjustAmount(1);
    setAdjustReason('');
    setIsAdjustDialogOpen(true);
  };

  if (!studentId) return null;

  return (
    <>
      <Card variant="bordered-blue" className="shadow-impressionist shadow-subtle-glow">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <RefreshCw className="w-5 h-5 mr-2" />
              Créditos de Reposição
            </span>
            <Badge variant="secondary">Sistema Integrado</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Saldo Atual */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-4">
              {isAdmin && (
                <Button 
                  size="icon" 
                  variant="outline" 
                  onClick={handleDecrement}
                  disabled={isLoading || credits <= 0}
                >
                  <Minus className="w-4 h-4" />
                </Button>
              )}
              <div>
                <p className="text-5xl font-bold text-primary">{credits}</p>
                <p className="text-lg text-muted-foreground mt-2">Crédito(s) Disponível(is)</p>
              </div>
              {isAdmin && (
                <Button 
                  size="icon" 
                  variant="outline" 
                  onClick={handleIncrement}
                  disabled={isLoading}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Informações sobre o Sistema */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground mb-2">
              <strong>Como funciona:</strong>
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Créditos são ganhos quando o aluno falta em aula recorrente</li>
              <li>• Cada crédito permite uma aula de reposição gratuita</li>
              <li>• Créditos expiram no início de cada mês</li>
              <li>• Use os botões para ajustar manualmente (admin)</li>
            </ul>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onViewCreditHistory}
              className="flex-1"
            >
              <History className="w-4 h-4 mr-2" />
              Ver Histórico
            </Button>
            {isAdmin && (
              <Button 
                onClick={handleIncrement}
                size="sm"
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Crédito
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para ajustar créditos */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAdding ? 'Adicionar Créditos' : 'Remover Créditos'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Quantidade de Créditos</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                max="10"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo do Ajuste</Label>
              <Textarea
                id="reason"
                placeholder="Ex: Bônus por indicação, ajuste por erro, etc."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button 
              onClick={handleAdjustCredit}
              disabled={!adjustReason.trim() || (!isAdding && credits <= 0)}
            >
              {isAdding ? 'Adicionar' : 'Remover'} Créditos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentCreditIntegration;