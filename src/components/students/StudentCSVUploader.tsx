import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Loader2, Upload } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import Papa from 'papaparse';
import { Student } from '@/types/student';

interface StudentCSVUploaderProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const StudentCSVUploader = ({ isOpen, onOpenChange }: StudentCSVUploaderProps) => {
  const queryClient = useQueryClient();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const mutation = useMutation({
    mutationFn: async (studentsData: any[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Inserir todos os alunos
      const studentsToInsert = studentsData.map(s => ({
        user_id: user.id,
        name: s.Nome,
        plan_type: s.plan_type,
        plan_frequency: s.plan_frequency,
        monthly_fee: s.monthly_fee,
        payment_method: s.payment_method,
        status: 'Ativo', // Default status for new imported students
        enrollment_type: 'Particular', // Default enrollment type
      }));

      const { data: insertedStudents, error: studentError } = await supabase
        .from('students')
        .insert(studentsToInsert)
        .select();

      if (studentError) throw new Error(`Erro ao inserir alunos: ${studentError.message}`);
      if (!insertedStudents) throw new Error("Nenhum aluno foi inserido.");

      // 2. Criar as transações financeiras para cada aluno inserido
      const transactionsToInsert = insertedStudents.map(student => {
        const originalData = studentsData.find(s => s.Nome === student.name);
        if (!originalData) return null;

        return {
          user_id: user.id,
          student_id: student.id,
          description: `Mensalidade - ${originalData.Plano}`,
          category: 'Mensalidade',
          amount: originalData.monthly_fee,
          type: 'revenue',
          status: originalData.Status === 'Pago' ? 'Pago' : 'Pendente',
          due_date: originalData.due_date,
          paid_at: originalData.Status === 'Pago' ? new Date().toISOString() : null,
        };
      }).filter(Boolean);

      if (transactionsToInsert.length > 0) {
        const { error: transactionError } = await supabase
          .from('financial_transactions')
          .insert(transactionsToInsert as any);
        if (transactionError) throw new Error(`Erro ao inserir transações: ${transactionError.message}`);
      }
      
      return insertedStudents.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      showSuccess(`${count} alunos importados com sucesso!`);
      onOpenChange(false);
    },
    onError: (error: any) => {
      showError(error.message);
    },
    onSettled: () => {
      setIsProcessing(false);
      setCsvFile(null);
    }
  });

  const handleFileUpload = () => {
    if (!csvFile) {
      showError("Por favor, selecione um arquivo CSV.");
      return;
    }
    setIsProcessing(true);

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const requiredColumns = ['Nome', 'Plano', 'Valor pago', 'Forma de pagamento', 'Status', 'Data de vencimento'];
        const headers = results.meta.fields || [];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
          showError(`Arquivo CSV inválido. Colunas faltando: ${missingColumns.join(', ')}`);
          setIsProcessing(false);
          return;
        }

        try {
          const processedData = results.data.map((row: any) => {
            // Data validation and transformation
            if (!row.Nome || !row.Plano) {
              throw new Error(`Linha inválida encontrada: ${JSON.stringify(row)}`);
            }
            const [plan_type, plan_frequency] = row.Plano.split(' ');
            const monthly_fee = parseFloat(row['Valor pago'].replace(',', '.'));
            const [day, month, year] = row['Data de vencimento'].split('/');
            const due_date = new Date(`${year}-${month}-${day}`).toISOString();

            return {
              ...row,
              plan_type,
              plan_frequency,
              monthly_fee,
              due_date,
            };
          });
          mutation.mutate(processedData);
        } catch (error: any) {
          showError(`Erro ao processar os dados do CSV: ${error.message}`);
          setIsProcessing(false);
        }
      },
      error: (error: any) => {
        showError(`Erro ao ler o arquivo CSV: ${error.message}`);
        setIsProcessing(false);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Alunos via CSV</DialogTitle>
          <DialogDescription>
            Selecione um arquivo CSV para cadastrar múltiplos alunos de uma vez.
            O arquivo deve conter as colunas: `Nome`, `Plano`, `Valor pago`, `Forma de pagamento`, `Status`, `Data de vencimento`.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Arquivo CSV</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
              disabled={isProcessing}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isProcessing}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleFileUpload} disabled={!csvFile || isProcessing}>
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isProcessing ? 'Processando...' : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentCSVUploader;