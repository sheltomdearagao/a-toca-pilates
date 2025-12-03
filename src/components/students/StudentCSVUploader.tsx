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
import { format, parseISO, addDays, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

// Tipos
interface StudentCSVUploaderProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

interface CSVRow {
  Nome: string;
  Email?: string;
  Telefone?: string;
  Endereco?: string;
  'Telefone Responsavel'?: string;
  Notas?: string;
  'Data Nascimento'?: string;
  'Dias Preferidos'?: string;
  'Horario Preferido'?: string;
  Plano?: string;
  'Valor pago'?: string;
  'Forma de pagamento'?: string;
  Status?: string;
  'Data de vencimento'?: string;
  Validade?: string;
  'Tipo Matricula'?: string;
  'Descricao Desconto'?: string;
  'Data de Pagamento'?: string; // Nova coluna
  [key: string]: string | undefined;
}

interface ProcessedStudent {
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  guardian_phone: string | null;
  notes: string | null;
  date_of_birth: string | null;
  preferred_days: string[] | null;
  preferred_time: string | null;
  discount_description: string | null;
  plan_type: string;
  plan_frequency: string | null;
  monthly_fee: number;
  payment_method: string | null;
  status: string;
  enrollment_type: string;
  validity_date: string | null;
  due_day: string | null; // Added due_day to match usage
  rawData: CSVRow;
}

interface ColumnMapping {
  [key: string]: string;
}

// Constantes
const CHUNK_SIZE = 20;

// Funções auxiliares
const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .trim();
};

const getColumnMapping = (headers: string[]): ColumnMapping => {
  const mapping: ColumnMapping = {};
  
  headers.forEach(header => {
    const normalized = normalizeColumnName(header);
    
    if (['nome', 'name'].includes(normalized)) {
      mapping.name = header;
    } else if (['email'].includes(normalized)) {
      mapping.email = header;
    } else if (['telefone', 'phone', 'tel'].includes(normalized)) {
      mapping.phone = header;
    } else if (['endereco', 'address'].includes(normalized)) {
      mapping.address = header;
    } else if (['telefoneresponsavel', 'guardianphone', 'telresponsavel'].includes(normalized)) {
      mapping.guardianPhone = header;
    } else if (['notas', 'notes'].includes(normalized)) {
      mapping.notes = header;
    } else if (['datanascimento', 'birthdate', 'data_nascimento'].includes(normalized)) {
      mapping.birthDate = header;
    } else if (['diaspreferidos', 'preferreddays'].includes(normalized)) {
      mapping.preferredDays = header;
    } else if (['horariopreferido', 'preferredtime', 'horario_preferido'].includes(normalized)) {
      mapping.preferredTime = header;
    } else if (['descricaodesconto', 'discountdescription'].includes(normalized)) {
      mapping.discountDescription = header;
    } else if (['plano', 'plan'].includes(normalized)) {
      mapping.plan = header;
    } else if (['valorpago', 'paymentvalue', 'valor_pago'].includes(normalized)) {
      mapping.monthlyFee = header;
    } else if (['formadepagamento', 'paymentmethod'].includes(normalized)) {
      mapping.paymentMethod = header;
    } else if (['status'].includes(normalized)) {
      mapping.status = header;
    } else if (['datavencimento', 'duedate'].includes(normalized)) {
      mapping.dueDate = header;
    } else if (['validade', 'validity'].includes(normalized)) {
      mapping.validityDate = header;
    } else if (['tipomatricula', 'enrollmenttype'].includes(normalized)) {
      mapping.enrollmentType = header;
    } else if (['datadepagamento', 'paidat', 'data_pagamento'].includes(normalized)) {
      mapping.paidAt = header;
    }
  });

  return mapping;
};

const parseDate = (dateString: string | undefined): string | null => {
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

const parseCurrency = (currencyString: string | undefined): number => {
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

const validateTime = (timeStr: string | undefined): string | null => {
  if (!timeStr) return null;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]/;
  if (timeRegex.test(timeStr)) {
    return timeStr.match(timeRegex)![0];
  }
  console.warn('⚠️ Horário inválido:', timeStr);
  return null;
};

const processStudentRow = (
  row: CSVRow, 
  index: number, 
  columnMapping: ColumnMapping, 
  userId: string,
  errors: string[]
): ProcessedStudent | null => {
  try {
    if (!row.Nome || row.Nome.trim() === '') {
      const errMsg = `Linha ${index + 2}: Nome é obrigatório`;
      console.warn('⚠️', errMsg);
      errors.push(errMsg);
      return null;
    }

    // Mapeamento flexível de colunas
    const name = row[columnMapping.name || 'Nome']?.trim() || '';
    const email = row[columnMapping.email || 'Email'] || null;
    const phone = row[columnMapping.phone || 'Telefone'] || null;
    const address = row[columnMapping.address || 'Endereco'] || null;
    const guardianPhone = row[columnMapping.guardianPhone || 'Telefone Responsavel'] || null;
    const notes = row[columnMapping.notes || 'Notas'] || null;
    const birthDateRaw = row[columnMapping.birthDate || 'Data Nascimento'] || null;
    const preferredDaysRaw = row[columnMapping.preferredDays || 'Dias Preferidos'] || null;
    const preferredTimeRaw = row[columnMapping.preferredTime || 'Horario Preferido'] || null;
    const discountDescription = row[columnMapping.discountDescription || 'Descricao Desconto'] || null;
    const planRaw = row[columnMapping.plan || 'Plano'] || 'Avulso';
    const monthlyFeeRaw = row[columnMapping.monthlyFee || 'Valor pago'] || 0;
    const paymentMethodRaw = row[columnMapping.paymentMethod || 'Forma de pagamento'] || null;
    const statusRaw = row[columnMapping.status || 'Status'] || 'Ativo';
    const dueDateRaw = row[columnMapping.dueDate || 'Data de vencimento'] || null;
    const validityDateRaw = row[columnMapping.validityDate || 'Validade'] || null;
    const enrollmentTypeRaw = row[columnMapping.enrollmentType || 'Tipo Matricula'] || 'Particular';
    const paidAtRaw = row[columnMapping.paidAt || 'Data de Pagamento'] || null;

    // Processamento de dados
    const birthDate = parseDate(birthDateRaw);
    const preferredDays = preferredDaysRaw ? preferredDaysRaw.split(',').map((d: string) => d.trim().toLowerCase()) : null;
    const preferredTime = validateTime(preferredTimeRaw);
    const dueDate = parseDate(dueDateRaw);
    const validityDate = parseDate(validityDateRaw);
    const paidAt = parseDate(paidAtRaw);

    // Processar plano
    const planParts = planRaw.trim().split(/\s+/);
    const plan_type = planParts[0] || 'Avulso';
    const plan_frequency = planParts.find((p: string) => p.toLowerCase().includes('x')) || null;
    
    return {
      user_id: userId,
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
      monthly_fee: parseCurrency(monthlyFeeRaw.toString()),
      payment_method: paymentMethodRaw,
      status: statusRaw,
      enrollment_type: enrollmentTypeRaw,
      validity_date: validityDate,
      due_day: dueDate, // Fixed due_day reference
      rawData: row,
    };
  } catch (err: any) {
    const errMsg = `Erro processando linha ${index + 2}: ${err.message}`;
    console.error('❌', errMsg, 'Dados da linha:', row);
    errors.push(errMsg);
    return null;
  }
};

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

  const processAndImportData = async (studentsData: ProcessedStudent[], userId: string) => {
    setIsProcessing(true);
    setTotalCount(studentsData.length);
    let totalSuccess = 0;
    const errors: string[] = [];

    try {
      console.log('📤 Iniciando importação de', studentsData.length, 'alunos...');

      for (let i = 0; i < studentsData.length; i += CHUNK_SIZE) {
        const chunk = studentsData.slice(i, i + CHUNK_SIZE);
        console.log(`📤 Processando lote ${Math.floor(i/CHUNK_SIZE) + 1}: linhas ${i+1} a ${Math.min(i + CHUNK_SIZE, studentsData.length)}`);

        const studentsToInsert = chunk.map(student => {
          console.log(`🔍 Processando aluno:`, student.name);
          return {
            user_id: student.user_id,
            name: student.name,
            email: student.email,
            phone: student.phone,
            address: student.address,
            guardian_phone: student.guardian_phone,
            notes: student.notes,
            date_of_birth: student.date_of_birth,
            preferred_days: student.preferred_days,
            preferred_time: student.preferred_time,
            discount_description: student.discount_description,
            enrollment_type: student.enrollment_type,
            status: student.status,
          };
        });

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

        // Processar cada aluno do lote para criar plano, assinatura e lançamento financeiro
        for (const [index, student] of chunk.entries()) {
          const insertedStudent = insertedStudents[index];
          const studentId = insertedStudent.id;
          
          // 2. Tratar o plano
          const planName = student.plan_type;
          let planId = null;
          
          if (planName && planName !== 'Avulso') {
            const { data: planData, error: planError } = await supabase
              .from('plans')
              .select('id')
              .eq('name', planName)
              .single();
            
            if (planError && planError.code !== 'PGRST116') {
              const errMsg = `Erro ao buscar plano '${planName}': ${planError.message}`;
              console.error('❌', errMsg);
              errors.push(errMsg);
              continue;
            }
            
            if (planData) {
              planId = planData.id;
            } else {
              // Criar novo plano
              const { data: newPlan, error: createPlanError } = await supabase
                .from('plans')
                .insert({
                  name: planName,
                  frequency: student.plan_frequency ? parseInt(student.plan_frequency) : 0,
                  default_price: student.monthly_fee,
                  active: true
                })
                .select()
                .single();
              
              if (createPlanError) {
                const errMsg = `Erro ao criar plano '${planName}': ${createPlanError.message}`;
                console.error('❌', errMsg);
                errors.push(errMsg);
                continue;
              }
              
              planId = newPlan.id;
            }
          }
          
          // 3. Criar assinatura
          if (planId) {
            const { data: newSubscription, error: subscriptionError } = await supabase
              .from('subscriptions')
              .insert({
                student_id: studentId,
                plan_id: planId,
                price: student.monthly_fee,
                frequency: student.plan_frequency ? parseInt(student.plan_frequency) : 0,
                start_date: student.validity_date ? new Date(student.validity_date).toISOString() : new Date().toISOString(),
                due_day: student.due_day ? parseInt(student.due_day) : 10, // Fixed due_day usage
                status: 'active'
              })
              .select()
              .single();
            
            if (subscriptionError) {
              const errMsg = `Erro ao criar assinatura para ${student.name}: ${subscriptionError.message}`;
              console.error('❌', errMsg);
              errors.push(errMsg);
              continue;
            }
            
            // 4. Lançamento Financeiro (apenas para Particulares)
            if (student.enrollment_type === 'Particular' && student.monthly_fee > 0) {
              const { error: transactionError } = await supabase
                .from('financial_transactions')
                .insert({
                  user_id: userId,
                  student_id: studentId,
                  subscription_id: newSubscription.id,
                  amount: student.monthly_fee,
                  payment_method: student.payment_method,
                  paid_at: student.validity_date ? new Date(student.validity_date).toISOString() : new Date().toISOString(),
                  description: `Mensalidade - ${student.plan_type} ${student.plan_frequency || ''}`,
                  type: 'revenue',
                  status: 'paid',
                  category: 'Mensalidade'
                });
              
              if (transactionError) {
                const errMsg = `Erro ao criar lançamento financeiro para ${student.name}: ${transactionError.message}`;
                console.error('❌', errMsg);
                errors.push(errMsg);
              }
            }
          }
        }

        const newProcessedCount = Math.min(i + CHUNK_SIZE, studentsData.length);
        setProcessedCount(newProcessedCount);
        setProgress((newProcessedCount / studentsData.length) * 100);
      }

      // Invalidação agressiva de cache
      console.log('🔄 Invalidando cache...');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['studentProfileData'] });
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
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async () => {
    if (!csvFile) {
      showError("Por favor, selecione um arquivo CSV.");
      return;
    }

    setParseErrors([]);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        showError('Usuário não autenticado. Faça login novamente.');
        return;
      }

      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        transformHeader: (header) => header.trim().replace(/^\ufeff/, ''),
        complete: (results) => {
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

          const errors: string[] = [];
          const studentsData = results.data.map((row: CSVRow, index: number) => {
            return processStudentRow(row, index, columnMapping, user.id, errors);
          }).filter(Boolean) as ProcessedStudent[];

          if (studentsData.length === 0) {
            showError('Nenhum dado válido encontrado no CSV. Verifique o formato das colunas.');
            return;
          }

          console.log(`📊 Total de linhas válidas: ${studentsData.length}`);
          setParseErrors(errors);
          processAndImportData(studentsData, user.id);
        },
        error: (error: any) => {
          console.error('❌ Erro ao parsear CSV:', error);
          showError(`Erro ao ler o arquivo CSV: ${error}`);
        }
      });
    } catch (error: any) {
      console.error('❌ Erro geral na importação:', error);
      showError(`Falha na importação: ${error.message}. Verifique o console.`);
    }
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
                <li><strong>Data de Pagamento (opcional - dd/mm/yyyy)</strong></li>
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