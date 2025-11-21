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
import { Loader2, Upload, AlertCircle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import Papa from 'papaparse';
import { format, parseISO } from 'date-fns';

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
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const resetState = () => {
    setCsvFile(null);
    setIsProcessing(false);
    setProgress(0);
    setProcessedCount(0);
    setTotalCount(0);
    setParseErrors([]);
  };

  const handleClose = (open: boolean) => {
    if (!isProcessing) {
      onOpenChange(open);
      resetState();
    }
  };

  // Função para normalizar nomes de colunas (case insensitive, remove acentos)
  const normalizeColumnName = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\s+/g, '') // Remove espaços
      .trim();
  };

  // Mapeamento flexível de colunas (aceita variações)
  const getColumnMapping = (headers: string[]) => {
    const mapping: { [key: string]: string } = {};
    
    headers.forEach(header => {
      const normalized = normalizeColumnName(header);
      
      // Nome (obrigatório)
      if (['nome', 'name'].includes(normalized)) {
        mapping.name = header;
      }
      
      // Email
      if (['email'].includes(normalized)) {
        mapping.email = header;
      }
      
      // Telefone
      if (['telefone', 'phone', 'tel'].includes(normalized)) {
        mapping.phone = header;
      }
      
      // Endereço
      if (['endereco', 'address'].includes(normalized)) {
        mapping.address = header;
      }
      
      // Telefone Responsável
      if (['telefoneresponsavel', 'guardianphone', 'telresponsavel'].includes(normalized)) {
        mapping.guardianPhone = header;
      }
      
      // Notas
      if (['notas', 'notes'].includes(normalized)) {
        mapping.notes = header;
      }
      
      // Data de Nascimento
      if (['datanascimento', 'birthdate', 'data_nascimento'].includes(normalized)) {
        mapping.birthDate = header;
      }
      
      // Dias Preferidos
      if (['diaspreferidos', 'preferreddays'].includes(normalized)) {
        mapping.preferredDays = header;
      }
      
      // Horário Preferido
      if (['horariopreferido', 'preferredtime', 'horario_preferido'].includes(normalized)) {
        mapping.preferredTime = header;
      }
      
      // Descrição Desconto
      if (['descricaodesconto', 'discountdescription'].includes(normalized)) {
        mapping.discountDescription = header;
      }
      
      // Plano
      if (['plano', 'plan'].includes(normalized)) {
        mapping.plan = header;
      }
      
      // Valor Pago
      if (['valorpago', 'paymentvalue', 'valor_pago'].includes(normalized)) {
        mapping.monthlyFee = header;
      }
      
      // Forma de Pagamento
      if (['formadepagamento', 'paymentmethod'].includes(normalized)) {
        mapping.paymentMethod = header;
      }
      
      // Status
      if (['status'].includes(normalized)) {
        mapping.status = header;
      }
      
      // Data de Vencimento
      if (['datavencimento', 'duedate'].includes(normalized)) {
        mapping.dueDate = header;
      }
      
      // Validade
      if (['validade', 'validity'].includes(normalized)) {
        mapping.validityDate = header;
      }
      
      // Tipo Matrícula
      if (['tipomatricula', 'enrollmenttype'].includes(normalized)) {
        mapping.enrollmentType = header;
      }
    });

    console.log('📊 Mapeamento de colunas detectado:', mapping);
    return mapping;
  };

  const processAndImportData = async (studentsData: any[], user: any) => {
    setIsProcessing(true);
    setTotalCount(studentsData.length);
    let totalSuccess = 0;
    const errors: string[] = [];

    try {
      console.log('📤 Iniciando importação de', studentsData.length, 'alunos...');

      for (let i = 0; i < studentsData.length; i += CHUNK_SIZE) {
        const chunk = studentsData.slice(i, i + CHUNK_SIZE);
        console.log(`📤 Processando lote ${Math.floor(i/CHUNK_SIZE) + 1}: linhas ${i+1} a ${Math.min(i + CHUNK_SIZE, studentsData.length)}`);

        const studentsToInsert = chunk.map((s, index) => {
          try {
            const globalIndex = i + index;
            console.log(`🔍 Processando linha ${globalIndex + 1}:`, s.Nome || 'Sem nome');

            // Validação básica
            if (!s.Nome || s.Nome.trim() === '') {
              const errMsg = `Linha ${globalIndex + 1}: Nome é obrigatório`;
              console.warn('⚠️', errMsg);
              errors.push(errMsg);
              return null;
            }

            // Mapeamento de campos com fallback
            const planString = s.Plano || s['Tipo Plano'] || 'Avulso';
            const planParts = planString.trim().split(/\s+/);
            const plan_type = planParts[0] || 'Avulso';
            const plan_frequency = planParts.find((p: string) => p.toLowerCase().includes('x')) || null;
            
            const monthly_fee = parseCurrency(s['Valor pago'] || s['Mensalidade'] || 0);
            const enrollmentType = s['Tipo Matricula'] || s['Tipo Matrícula'] || 'Particular';
            
            // Horário preferido - valida e formata
            const rawTime = s['Horario Preferido'] || s['Horário Preferido'];
            const cleanTime = validateTime(rawTime);

            const processedRow = {
              user_id: user.id,
              name: s.Nome?.trim() || '',
              email: s.Email || null,
              phone: s.Telefone || null,
              address: s.Endereco || null,
              guardian_phone: s['Telefone Responsavel'] || s['Tel Responsável'] || null,
              notes: s.Notas || null,
              date_of_birth: parseDate(s['Data Nascimento'] || s['Data de Nascimento']),
              preferred_days: s['Dias Preferidos'] ? s['Dias Preferidos'].split(',').map((d: string) => d.trim().toLowerCase()) : null,
              preferred_time: cleanTime,
              discount_description: s['Descricao Desconto'] || s['Descrição Desconto'] || null,
              
              // Campos de Plano e Status
              plan_type,
              plan_frequency,
              monthly_fee,
              payment_method: s['Forma de pagamento'] || s['Método Pagamento'] || null,
              status: s.Status || 'Ativo',
              enrollment_type: enrollmentType,
              validity_date: parseDate(s['Validade'] || s['Data Validade']),
              
              // Log para debug
              rawData: s, // Para debug no console
            };

            console.log(`✅ Linha ${globalIndex + 1} processada:`, {
              name: processedRow.name,
              plan_type,
              monthly_fee,
              enrollment_type,
              preferred_time: cleanTime,
              date_of_birth: processedRow.date_of_birth,
              validity_date: processedRow.validity_date
            });

            return processedRow;
          } catch (err: any) {
            const errMsg = `Erro processando linha ${i + index + 1}: ${err.message}`;
            console.error('❌', errMsg);
            errors.push(errMsg);
            return null;
          }
        }).filter(Boolean); // Remove nulls (linhas inválidas)

        if (studentsToInsert.length === 0) {
          console.log('⚠️ Nenhum aluno válido neste lote');
          continue;
        }

        console.log(`📤 Inserindo ${studentsToInsert.length} alunos do lote...`);

        const { data: insertedStudents, error: studentError } = await supabase
          .from('students')
          .insert(studentsToInsert)
          .select('id, name');

        if (studentError) {
          const errMsg = `Erro ao inserir lote de alunos: ${studentError.message}`;
          console.error('❌', errMsg);
          errors.push(errMsg);
          throw new Error(errMsg);
        }

        if (!insertedStudents || insertedStudents.length === 0) {
          const errMsg = "Nenhum aluno foi inserido neste lote.";
          console.error('❌', errMsg);
          errors.push(errMsg);
          throw new Error(errMsg);
        }

        console.log(`✅ ${insertedStudents.length} alunos inseridos. IDs:`, insertedStudents.map(s => s.id));

        // Inserir transações para alunos com mensalidade > 0
        const transactionsToInsert = insertedStudents.map((student, idx) => {
          const originalData = chunk[idx];
          if (!originalData || !originalData.monthly_fee || originalData.monthly_fee <= 0) {
            console.log(`⏭️ Pulando transação para ${student.name} (sem valor)`);
            return null;
          }
          
          const transactionStatus = originalData.Status === 'Pago' ? 'Pago' : 'Pendente';
          const finalDueDate = parseDate(originalData['Data de vencimento'] || new Date().toISOString());

          const transaction = {
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

          console.log(`💰 Criando transação para ${student.name}:`, {
            amount: transaction.amount,
            status: transaction.status,
            due_date: finalDueDate
          });

          return transaction;
        }).filter(Boolean);

        if (transactionsToInsert.length > 0) {
          const { error: transactionError } = await supabase
            .from('financial_transactions')
            .insert(transactionsToInsert as any);
          
          if (transactionError) {
            const errMsg = `Erro ao inserir transações do lote: ${transactionError.message}`;
            console.error('❌', errMsg);
            errors.push(errMsg);
            throw new Error(errMsg);
          }
          console.log(`✅ ${transactionsToInsert.length} transações criadas`);
        }

        const newProcessedCount = Math.min(i + CHUNK_SIZE, studentsData.length);
        setProcessedCount(newProcessedCount);
        setProgress((newProcessedCount / studentsData.length) * 100);
      }

      // Invalidação agressiva de cache
      console.log('🔄 Invalidando cache...');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['studentProfileData'] }); // Para perfis individuais
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['studentStats'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      queryClient.invalidateQueries({ queryKey: ['birthdayStudents'] });

      // Refetch imediato para garantir
      await queryClient.refetchQueries({ queryKey: ['students'] });
      await queryClient.refetchQueries({ queryKey: ['studentProfileData'] });

      if (errors.length > 0) {
        console.warn('⚠️ Erros durante o processamento:', errors);
        showError(`Importação concluída com ${errors.length} erro(s). Verifique o console para detalhes.`);
      } else {
        showSuccess(`${totalSuccess} alunos importados com sucesso!`);
      }

      onOpenChange(false);
      resetState();

    } catch (error: any) {
      console.error('❌ Erro geral na importação:', error);
      showError(`Falha na importação: ${error.message}. Verifique o console.`);
      setParseErrors(errors);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Funções de Parsing e Correção (melhoradas) ---

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
        console.warn('⚠️ Erro ao parsear data:', dateString, e);
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
    console.warn('⚠️ Horário inválido:', timeStr);
    return null;
  };

  // Detecta se a string parece um dia da semana (Inglês ou Português)
  const isDayString = (str: string) => {
    if (!str) return false;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 
                  'segunda', 'terca', 'terça', 'quarta', 'quinta', 'sexta', 'sabado', 'sábado', 'domingo'];
    return days.some(day => str.toLowerCase().includes(day));
  };

  const handleFileUpload = async () => {
    if (!csvFile) {
      showError("Por favor, selecione um arquivo CSV.");
      return;
    }

    // Reset errors
    setParseErrors([]);

    const errors: string[] = [];

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      transformHeader: (header) => header.trim().replace(/^\ufeff/, ''),
      complete: async (results) => {
        console.log('📊 CSV parseado. Headers detectados:', results.meta.fields);
        
        const requiredColumns = ['Nome']; 
        const headers = results.meta.fields || [];
        const missingColumns = requiredColumns.filter(col => !headers.some(h => normalizeColumnName(h) === 'nome'));

        if (missingColumns.length > 0) {
          showError(`Arquivo CSV inválido. Colunas obrigatórias faltando: ${missingColumns.join(', ')}`);
          return;
        }

        const columnMapping = getColumnMapping(headers);
        console.log('🔍 Mapeamento de colunas:', columnMapping);

        try {
          const processedData = results.data.map((row: any, index: number) => {
            try {
              if (!row.Nome || row.Nome.trim() === '') {
                const errMsg = `Linha ${index + 2}: Nome é obrigatório`;
                console.warn('⚠️', errMsg);
                errors.push(errMsg);
                return null;
              }

              // Mapeamento flexível baseado no mapping
              const name = row[columnMapping.name || 'Nome']?.trim() || '';
              const email = row[columnMapping.email || 'Email'] || null;
              const phone = row[columnMapping.phone || 'Telefone'] || null;
              const address = row[columnMapping.address || 'Endereco'] || null;
              const guardianPhone = row[columnMapping.guardianPhone || 'Telefone Responsavel'] || null;
              const notes = row[columnMapping.notes || 'Notas'] || null;
              const birthDate = parseDate(row[columnMapping.birthDate || 'Data Nascimento'] || null);
              const preferredDays = row[columnMapping.preferredDays || 'Dias Preferidos'] ? row[columnMapping.preferredDays].split(',').map((d: string) => d.trim().toLowerCase()) : null;
              const preferredTime = validateTime(row[columnMapping.preferredTime || 'Horario Preferido'] || null);
              const discountDescription = row[columnMapping.discountDescription || 'Descricao Desconto'] || null;
              
              // Plano
              const planString = row[columnMapping.plan || 'Plano'] || 'Avulso';
              const planParts = planString.trim().split(/\s+/);
              const plan_type = planParts[0] || 'Avulso';
              const plan_frequency = planParts.find((p: string) => p.toLowerCase().includes('x')) || null;
              
              // Valor
              const monthly_fee = parseCurrency(row[columnMapping.monthlyFee || 'Valor pago'] || 0);
              
              // Pagamento
              const paymentMethod = row[columnMapping.paymentMethod || 'Forma de pagamento'] || null;
              
              // Status
              const status = row[columnMapping.status || 'Status'] || 'Ativo';
              
              // Tipo Matrícula
              const enrollmentType = row[columnMapping.enrollmentType || 'Tipo Matricula'] || 'Particular';
              
              // Datas
              const dueDate = parseDate(row[columnMapping.dueDate || 'Data de vencimento'] || null);
              const validityDate = parseDate(row[columnMapping.validityDate || 'Validade'] || null);

              const processedRow = {
                user_id: user.id,
                name,
                email,
                phone,
                address,
                guardian_phone: guardianPhone,
                notes,
                date_of_birth: birthDate,
                preferred_days: preferredDays,
                preferred_time: preferredTime,
                discount_description: discountDescription,
                plan_type,
                plan_frequency,
                monthly_fee,
                payment_method: paymentMethod,
                status,
                enrollment_type: enrollmentType,
                validity_date: validityDate,
                
                // Log para debug
                rawRow: row, // Salva a linha original para debug
              };

              console.log(`✅ Linha ${index + 2} processada com sucesso:`, {
                name,
                plan_type,
                monthly_fee,
                enrollment_type,
                preferred_time,
                date_of_birth: birthDate ? format(parseISO(birthDate), 'dd/MM/yyyy') : null,
                validity_date: validityDate ? format(parseISO(validityDate), 'dd/MM/yyyy') : null
              });

              return processedRow;
            } catch (err: any) {
              const errMsg = `Erro processando linha ${index + 2}: ${err.message}`;
              console.error('❌', errMsg, 'Dados da linha:', row);
              errors.push(errMsg);
              return null;
            }
          }).filter(Boolean); // Remove linhas inválidas

          if (processedData.length === 0) {
            showError('Nenhum dado válido encontrado no CSV. Verifique o formato das colunas.');
            return;
          }

          console.log(`📊 Total de linhas válidas: ${processedData.length}`);
          await processAndImportData(processedData, user);
        } catch (error: any) {
          console.error('❌ Erro ao processar dados:', error);
          showError(`Erro ao processar dados: ${error}`);
        }
      },
      error: (error: any) => {
        console.error('❌ Erro ao parsear CSV:', error);
        showError(`Erro ao ler o arquivo CSV: ${error}`);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Alunos via CSV</DialogTitle>
          <DialogDescription>
            <div className="space-y-2 text-sm">
              <p><strong>Formato esperado das colunas (obrigatória: Nome):</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Nome</li>
                <li>Email (opcional)</li>
                <li>Telefone (opcional)</li>
                <li>Endereco (opcional)</li>
                <li>Telefone Responsavel (opcional)</li>
                <li>Notas (opcional)</li>
                <li>Data Nascimento (dd/mm/yyyy ou yyyy-mm-dd)</li>
                <li>Dias Preferidos (ex: Segunda, Terça - separados por vírgula)</li>
                <li>Horario Preferido (ex: 08:00)</li>
                <li>Plano (ex: Mensal 3x)</li>
                <li>Valor pago (ex: 260,00)</li>
                <li>Forma de pagamento (ex: Pix)</li>
                <li>Status (ex: Ativo)</li>
                <li>Data de vencimento (opcional)</li>
                <li>Validade (opcional)</li>
                <li>Tipo Matricula (ex: Particular)</li>
                <li>Descricao Desconto (opcional)</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                O sistema tenta corrigir automaticamente deslocamentos de colunas. Verifique o console (F12) para logs detalhados.
              </p>
              {parseErrors.length > 0 && (
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  <strong>Erros encontrados:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {parseErrors.slice(0, 3).map((err, idx) => <li key={idx}>{err}</li>)}
                    {parseErrors.length > 3 && <li>... e mais {parseErrors.length - 3} erros</li>}
                  </ul>
                </div>
              )}
            </div>
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