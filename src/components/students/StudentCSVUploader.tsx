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
          status: s.Status || 'Ativo', // Usar status do CSV ou 'Ativo'
          enrollment_type: s.enrollment_type || 'Particular', // Usar tipo de matrícula do CSV ou 'Particular'
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
          if (!originalData || !originalData.monthly_fee || originalData.monthly_fee <= 0) return null;
          
          const transactionStatus = originalData.Status === 'Pago' ? 'Pago' : 'Pendente';

          return {
            user_id: user.id,
            student_id: student.id,
            description: `Mensalidade - ${originalData.Plano}`,
            category: 'Mensalidade',
            amount: originalData.monthly_fee,
            type: 'revenue',
            status: transactionStatus,
            due_date: originalData.due_date,
            paid_at: transactionStatus === 'Pago' ? new Date().toISOString() : null,
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
    
    // Tenta limpar e padronizar a string de data (DD/MM/YYYY ou DD-MM-YYYY)
    const cleanedString = dateString.trim().replace(/[\/.-]/g, '-');
    const dateParts = cleanedString.split('-');
    
    if (dateParts.length !== 3) {
        // Se não tiver 3 partes, tenta o formato YYYY-MM-DD (ISO)
        const isoDate = new Date(dateString);
        if (!isNaN(isoDate.getTime())) return isoDate.toISOString();
        throw new Error(`Formato de data inválido: "${dateString}"`);
    }
    
    // Assume DD-MM-YYYY
    const [day, month, year] = dateParts;
    
    // Verifica se o ano tem 2 dígitos (ex: 24) e tenta corrigir para 4 dígitos (ex: 2024)
    const fullYear = year.length === 2 ? (parseInt(year) > 50 ? `19${year}` : `20${year}`) : year;

    const parsedDate = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`);
    
    if (isNaN(parsedDate.getTime())) throw new Error(`Data inválida: "${dateString}"`);
    return parsedDate.toISOString();
  };

  const parseCurrency = (currencyString: string) => {
    if (!currencyString) return 0;
    
    // 1. Remove todos os caracteres que não são dígitos, vírgulas ou pontos.
    let cleaned = currencyString.replace(/[^0-9,.]/g, '');
    
    // 2. Se houver vírgula e ponto, assume que o ponto é separador de milhar e a vírgula é decimal (formato BR).
    if (cleaned.includes(',') && cleaned.includes('.')) {
        // Remove separador de milhar (ponto) e substitui vírgula por ponto decimal.
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
        // Se houver apenas vírgula, assume que é o separador decimal.
        cleaned = cleaned.replace(',', '.');
    }
    
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
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
        const requiredColumns = ['Nome', 'Plano', 'Valor pago', 'Forma de pagamento', 'Status', 'Data de vencimento', 'Validade', 'Tipo Matrícula'];
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
              
              // Tenta extrair tipo e frequência do plano (ex: Mensal 3x)
              const planParts = row.Plano.trim().split(/\s+/);
              const plan_type = planParts[0] || 'Avulso';
              const plan_frequency = planParts.find(p => p.toLowerCase().includes('x')) || null;
              
              const monthly_fee = parseCurrency(row['Valor pago']);
              
              return {
                ...row,
                plan_type,
                plan_frequency,
                monthly_fee,
                enrollment_type: row['Tipo Matrícula'] || 'Particular',
                due_date: parseDate(row['Data de vencimento']),
                validity_date: parseDate(row['Validade']),
                Status: row.Status || 'Pendente',
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
            O arquivo deve conter as colunas: `Nome`, `Plano` (ex: Mensal 3x), `Valor pago`, `Forma de pagamento`, `Status` (Pago/Pendente), `Data de vencimento` (DD/MM/AAAA), `Validade` (DD/MM/AAAA), `Tipo Matrícula`.
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