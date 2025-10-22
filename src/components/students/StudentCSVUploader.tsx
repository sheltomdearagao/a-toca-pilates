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
        status: 'Ativo',
        enrollment_type: 'Particular',
        validity_date: s.validity_date, // Adicionando o novo campo
      }));

      const { data: insertedStudents, error: studentError } = await supabase
        .from('students')
        .insert(studentsToInsert)
        .select();

      if (studentError) throw new Error(`Erro ao inserir alunos: ${studentError.message}`);
      if (!insertedStudents) throw new Error("Nenhum aluno foi inserido.");

      // 2. Criar as transações financeiras
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

  const parseDate = (dateString: string) => {
    if (!dateString) return null;
    const dateParts = dateString.split(/[/.-]/);
    if (dateParts.length !== 3) throw new Error(`Formato de data inválido: "${dateString}"`);
    const [day, month, year] = dateParts;
    const parsedDate = new Date(`${year}-${month}-${day}T12:00:00Z`);
    if (isNaN(parsedDate.getTime())) throw new Error(`Data inválida: "${dateString}"`);
    return parsedDate.toISOString();
  };

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
        const requiredColumns = ['Nome', 'Plano', 'Valor pago', 'Forma de pagamento', 'Status', 'Data de vencimento', 'Validade'];
        const headers = results.meta.fields || [];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
          showError(`Arquivo CSV inválido. Colunas faltando: ${missingColumns.join(', ')}`);
          setIsProcessing(false);
          return;
        }

        try {
          const processedData = results.data.map((row: any, index: number) => {
            try {
              if (!row.Nome || !row.Plano) {
                throw new Error(`As colunas 'Nome' e 'Plano' são obrigatórias.`);
              }
              const [plan_type, plan_frequency] = row.Plano.split(' ');
              const monthly_fee = parseFloat(String(row['Valor pago']).replace(/[^0-9,.]/g, '').replace(',', '.'));
              
              return {
                ...row,
                plan_type,
                plan_frequency,
                monthly_fee,
                due_date: parseDate(row['Data de vencimento']),
                validity_date: parseDate(row['Validade']),
              };
            } catch (innerError: any) {
              throw new Error(`Erro na linha ${index + 2} do seu arquivo: ${innerError.message}`);
            }
          });
          mutation.mutate(processedData);
        } catch (error: any) {
          showError(error.message);
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
            O arquivo deve conter as colunas: `Nome`, `Plano`, `Valor pago`, `Forma de pagamento`, `Status`, `Data de vencimento`, `Validade`.
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