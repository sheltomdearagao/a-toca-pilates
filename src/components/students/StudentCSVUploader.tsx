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
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import Papa from 'papaparse';

interface StudentCSVUploaderProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const CHUNK_SIZE = 20;

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
          email: s.Email || null,
          phone: s.Telefone || null,
          address: s.Endereco || null,
          guardian_phone: s['Telefone Responsavel'] || null,
          notes: s.Notas || null,
          date_of_birth: s['Data Nascimento'] || null,
          preferred_days: s['Dias Preferidos'] ? s['Dias Preferidos'].split(',').map((d: string) => d.trim().toLowerCase()) : null,
          preferred_time: s['Horario Preferido'] || null, // Agora garantido ser hora ou null
          discount_description: s['Descricao Desconto'] || null,
          
          // Campos de Plano e Status
          plan_type: s.plan_type,
          plan_frequency: s.plan_frequency,
          monthly_fee: s.monthly_fee,
          payment_method: s['Forma de pagamento'] || null,
          status: s.Status || 'Ativo',
          enrollment_type: s.enrollment_type || 'Particular',
          validity_date: s.validity_date,
        }));

        const { data: insertedStudents, error: studentError } = await supabase
          .from('students')
          .insert(studentsToInsert)
          .select('id, name');

        if (studentError) throw new Error(`Erro ao inserir lote de alunos: ${studentError.message}`);
        if (!insertedStudents) throw new Error("Nenhum aluno foi inserido neste lote.");

        const transactionsToInsert = insertedStudents.map(student => {
          const originalData = chunk.find(s => s.Nome === student.name);
          if (!originalData || !originalData.monthly_fee || originalData.monthly_fee <= 0) return null;
          
          const transactionStatus = originalData.Status === 'Pago' ? 'Pago' : 'Pendente';
          const finalDueDate = originalData['Data de vencimento'] || new Date().toISOString();

          return {
            user_id: user.id,
            student_id: student.id,
            description: `Mensalidade - ${originalData.Plano || 'Avulso'}`,
            category: 'Mensalidade',
            amount: originalData.monthly_fee,
            type: 'revenue',
            status: transactionStatus,
            due_date: finalDueDate,
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
      queryClient.invalidateQueries({ queryKey: ['studentStats'] });
      showSuccess(`${totalSuccess} alunos importados com sucesso!`);
      onOpenChange(false);

    } catch (error: any) {
      console.error(error);
      showError(error.message);
    } finally {
      resetState();
    }
  };

  // --- Funções de Parsing e Correção ---

  const parseDate = (dateString: string) => {
    if (!dateString || typeof dateString !== 'string') return null;
    try {
        const cleanedString = dateString.trim().replace(/[\/.-]/g, '-');
        const dateParts = cleanedString.split('-');
        
        if (dateParts.length !== 3) {
            const isoDate = new Date(dateString);
            if (!isNaN(isoDate.getTime())) return isoDate.toISOString();
            return null; 
        }
        
        const [day, month, year] = dateParts;
        const fullYear = year.length === 2 ? (parseInt(year) > 50 ? `19${year}` : `20${year}`) : year;
        const parsedDate = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`);
        
        if (isNaN(parsedDate.getTime())) return null;
        return parsedDate.toISOString();
    } catch (e) {
        return null;
    }
  };

  const parseCurrency = (currencyString: string) => {
    if (!currencyString) return 0;
    if (typeof currencyString === 'number') return currencyString;
    
    let cleaned = currencyString.toString().replace(/[^0-9,.]/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(',', '.');
    }
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  };

  // Valida se a string é um horário HH:MM
  const validateTime = (timeStr: string) => {
    if (!timeStr) return null;
    // Regex simples para HH:MM ou H:MM
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]/;
    if (timeRegex.test(timeStr)) {
        // Retorna formatado para garantir compatibilidade com Time/Postgres
        return timeStr.match(timeRegex)![0];
    }
    return null;
  };

  // Detecta se a string parece um dia da semana (Inglês ou Português)
  const isDayString = (str: string) => {
    if (!str) return false;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 
                  'segunda', 'terca', 'terça', 'quarta', 'quinta', 'sexta', 'sabado', 'sábado', 'domingo'];
    return days.some(day => str.toLowerCase().includes(day));
  };

  const handleFileUpload = () => {
    if (!csvFile) {
      showError("Por favor, selecione um arquivo CSV.");
      return;
    }

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      transformHeader: (header) => header.trim().replace(/^\ufeff/, ''),
      complete: (results) => {
        const requiredColumns = ['Nome']; 
        const headers = results.meta.fields || [];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
          showError(`Arquivo CSV inválido. Colunas obrigatórias faltando: ${missingColumns.join(', ')}`);
          return;
        }

        try {
          const processedData = results.data.map((row: any, index: number) => {
            try {
              if (!row.Nome) return null;
              
              // --- CORREÇÃO DE DESLOCAMENTO DE COLUNAS ---
              // Se 'Horario Preferido' parece um dia, e 'Plano' parece uma hora, houve deslocamento.
              let cleanRow = { ...row };
              
              if (isDayString(row['Horario Preferido']) && validateTime(row['Plano'])) {
                // Realinha os dados
                cleanRow['Dias Preferidos'] = `${row['Dias Preferidos']}, ${row['Horario Preferido']}`;
                cleanRow['Horario Preferido'] = row['Plano']; // O horário estava na coluna Plano
                cleanRow['Plano'] = row['Valor pago']; // O nome do plano estava em Valor pago
                cleanRow['Valor pago'] = row['Forma de pagamento'];
                cleanRow['Forma de pagamento'] = row['Status'];
                cleanRow['Status'] = row['Data de vencimento'];
                cleanRow['Data de vencimento'] = row['Validade'];
                cleanRow['Validade'] = row['Tipo Matricula'] || row['Tipo Matrícula'];
                cleanRow['Tipo Matricula'] = row['Descricao Desconto']; // Assume que descrição vem depois
                // Descrição Desconto fica vazio ou pega a próxima coluna se existir
              }
              // -------------------------------------------

              const planString = cleanRow.Plano || 'Avulso';
              const planParts = planString.trim().split(/\s+/);
              const plan_type = planParts[0] || 'Avulso';
              const plan_frequency = planParts.find((p: string) => p.toLowerCase().includes('x')) || null;
              
              const monthly_fee = parseCurrency(cleanRow['Valor pago']);
              const enrollmentType = cleanRow['Tipo Matricula'] || cleanRow['Tipo Matrícula'] || 'Particular';
              
              // Garante que só envia hora válida ou null para o banco
              const cleanTime = validateTime(cleanRow['Horario Preferido']);

              return {
                ...cleanRow,
                plan_type,
                plan_frequency,
                monthly_fee,
                enrollment_type: enrollmentType,
                'Horario Preferido': cleanTime, // Usa o horário validado
                
                'Data de vencimento': parseDate(cleanRow['Data de vencimento']),
                validity_date: parseDate(cleanRow.Validade),
                'Data Nascimento': parseDate(cleanRow['Data Nascimento']),
                Status: cleanRow.Status || 'Ativo',
              };
            } catch (innerError: any) {
              console.error(`Erro processando linha ${index}:`, row);
              throw new Error(`Erro na linha ${index + 2}: ${innerError.message}`);
            }
          }).filter(Boolean);
          
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
            O arquivo deve conter a coluna obrigatória `Nome`. O sistema tentará corrigir automaticamente linhas com múltiplos dias não agrupados por aspas.
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