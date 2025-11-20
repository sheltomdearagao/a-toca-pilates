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