import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Student } from '@/types/student';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { differenceInDays, parseISO } from 'date-fns';

interface ProRataCalculatorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  student: Student;
}

const ProRataCalculator = ({ isOpen, onOpenChange, student }: ProRataCalculatorProps) => {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState('');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [proRataAmount, setProRataAmount] = useState<number | null>(null);

  const calculateProRata = () => {
    if (!startDate || !firstDueDate || !student.monthly_fee) {
      setProRataAmount(null);
      return;
    }
    const daysInPeriod = differenceInDays(parseISO(firstDueDate), parseISO(startDate));
    if (daysInPeriod <= 0) {
      showError("A data de vencimento deve ser posterior à data de início.");
      setProRataAmount(null);
      return;
    }
    const dailyRate = student.monthly_fee / 30; // Assume um mês de 30 dias para simplificar
    const calculatedAmount = dailyRate * daysInPeriod;
    setProRataAmount(parseFloat(calculatedAmount.toFixed(2)));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!proRataAmount || proRataAmount <= 0) {
        throw new Error("Valor proporcional inválido.");
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const transaction = {
        user_id: user.id,
        student_id: student.id,
        description: `Primeira Mensalidade (Proporcional)`,
        category: 'Mensalidade',
        amount: proRataAmount,
        type: 'revenue',
        status: 'Pendente',
        due_date: firstDueDate,
      };
      const { error } = await supabase.from('financial_transactions').insert([transaction]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentProfile', student.id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      showSuccess('Cobrança proporcional gerada com sucesso!');
      onOpenChange(false);
      setStartDate('');
      setFirstDueDate('');
      setProRataAmount(null);
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar 1ª Cobrança Proporcional</DialogTitle>
          <DialogDescription>
            Calcule o valor devido para o primeiro mês do aluno {student.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Data de Início das Aulas</Label>
            <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="first-due-date">Data do 1º Vencimento</Label>
            <Input id="first-due-date" type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
          </div>
          <Button onClick={calculateProRata} variant="outline" className="w-full">
            <Calculator className="w-4 h-4 mr-2" />
            Calcular Valor
          </Button>
          {proRataAmount !== null && (
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Valor Proporcional Calculado:</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proRataAmount)}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={() => mutation.mutate()} disabled={!proRataAmount || mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar Cobrança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProRataCalculator;