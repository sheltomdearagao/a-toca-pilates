import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Progress } from '@/components/ui/progress'; // Importar o componente de progresso
import { Loader2, Upload } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import Papa from 'papaparse';

interface StudentCSVUploaderProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const CHUNK_SIZE = 20; // Processar 20 alunos por vez

const StudentCSVUploader = ({ isOpen, onOpenChange }: StudentCSVUploaderProps) => {
  const queryClient = useQueryClient();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const resetState = () => {
    setCsvFile(null);
    setIsProcessing(false);
    setProgress(0);
    setProcessedCount(0);
    setTotalCount(0);
  };

  const handleClose = (open: boolean) => {
    if (!isProcessing) {
      onOpenChange(open);
      resetState();
    }
  };

  const processAndImportData = async (studentsData: any[]) => {
    setIsProcessing(true);
    setTotalCount(studentsData.length);
    let totalSuccess = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      for (let i = 0; i < studentsData.length; i += CHUNK_SIZE) {
        const chunk = studentsData.slice(i, i + CHUNK_SIZE);

        const studentsToInsert = chunk.map(s => ({
          user_id: user.id,
          name: s.Nome,
          plan_type: s.plan_type,
          plan_frequency: s.plan_frequency,
          monthly_fee: s.monthly_fee,
          payment_method: s.payment_method,
          status: 'Ativo',
          enrollment_type: 'Particular',
          validity_date: s.validity_date,
        }));

        const { data: insertedStudents, error: studentError } = await supabase
          .from('students')
          .insert(studentsToInsert)
          .select();

        if (studentError) throw new Error(`Erro ao inserir lote de alunos: ${studentError.message}`);
        if (!insertedStudents) throw new Error("Nenhum aluno foi inserido neste lote.");

        const transactionsToInsert = insertedStudents.map(student => {
          const originalData = chunk.find(s => s.Nome === student.name);
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
          if (transactionError) throw new Error(`Erro ao inserir transações do lote: ${transactionError.message}`);
        }
        
        totalSuccess += insertedStudents.length;
        const newProcessedCount = i + chunk.length;
        setProcessedCount(newProcessedCount > studentsData.length ? studentsData.length : newProcessedCount);
        setProgress((newProcessedCount / studentsData.length) * 100);
      }

      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      showSuccess(`${totalSuccess} alunos importados com sucesso!`);
      onOpenChange(false);

    } catch (error: any) {
      showError(error.message);
    } finally {
      resetState();
    }
  };

  const parseDate = (dateString: string) => {
    if (!dateString) return null;
    const dateParts = dateString.split(/[/.-]/);
    if (dateParts.length !== 3) throw new Error(`Formato de data inválido: "${dateString}"`);
    const [day, month, year] = dateParts;
    const parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`);
    if (isNaN(parsedDate.getTime())) throw new Error(`Data inválida: "${dateString}"`);
    return parsedDate.toISOString();
  };

  const handleFileUpload = () => {
    if (!csvFile) {
      showError("Por favor, selecione um arquivo CSV.");
      return;
    }

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const requiredColumns = ['Nome', 'Plano', 'Valor pago', 'Forma de pagamento', 'Status', 'Data de vencimento', 'Validade'];
        const headers = results.meta.fields || [];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
          showError(`Arquivo CSV inválido. Colunas faltando: ${missingColumns.join(', ')}`);
          return;
        }

        try {
          const processedData = results.data.map((row: any, index: number) => {
            try {
              if (!row.Nome || !row.Plano) throw new Error(`As colunas 'Nome' e 'Plano' são obrigatórias.`);
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
          processAndImportData(processedData);
        } catch (error: any) {
          showError(error.message);
        }
      },
      error: (error: any) => {
        showError(`Erro ao ler o arquivo CSV: ${error.message}`);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Alunos via CSV</DialogTitle>
          <DialogDescription>
            O arquivo deve conter as colunas: `Nome`, `Plano`, `Valor pago`, `Forma de pagamento`, `Status`, `Data de vencimento`, `Validade`.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {isProcessing ? (
            <div className="space-y-2">
              <Label>Processando...</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {processedCount} de {totalCount} alunos processados.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="csv-file">Arquivo CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
              />
            </div>
          )}
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