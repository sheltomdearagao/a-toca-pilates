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

  // --- Funções Auxiliares de Parsing ---

  const parseDate = (dateString: any) => {
    if (!dateString || typeof dateString !== 'string') return null;
    try {
        // Limpa espaços e caracteres invisíveis
        const cleanedString = dateString.trim().replace(/[\/.-]/g, '-');
        const dateParts = cleanedString.split('-');
        
        if (dateParts.length !== 3) return null;
        
        const [day, month, year] = dateParts;
        const fullYear = year.length === 2 ? (parseInt(year) > 50 ? `19${year}` : `20${year}`) : year;
        const parsedDate = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`);
        
        if (isNaN(parsedDate.getTime())) return null;
        return parsedDate.toISOString();
    } catch (e) { return null; }
  };

  const parseCurrency = (currencyString: any) => {
    if (!currencyString) return 0;
    const str = String(currencyString).trim();
    // Remove R$, espaços
    let cleaned = str.replace(/[R$\s]/g, '');
    // Formato Brasileiro (1.000,00) -> (1000.00)
    if (cleaned.includes(',') && cleaned.includes('.')) {
       cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
       cleaned = cleaned.replace(',', '.');
    }
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  };

  const validateTime = (timeStr: any) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    // Regex simples para HH:MM
    const match = timeStr.match(/([0-1]?[0-9]|2[0-3]):[0-5][0-9]/);
    return match ? match[0] : null;
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
          address: s.Endereco || null, // Agora corrigido
          guardian_phone: s['Telefone Responsavel'] || null,
          notes: s.Notas || null,
          date_of_birth: s['Data Nascimento'] || null,
          preferred_days: s['Dias Preferidos'] ? s['Dias Preferidos'].split(',').map((d: string) => d.trim().toLowerCase()) : null,
          preferred_time: s['Horario Preferido'] || null,
          discount_description: s['Descricao Desconto'] || null,
          
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

        if (studentError) throw new Error(`Erro ao inserir alunos: ${studentError.message}`);
        if (!insertedStudents) throw new Error("Falha ao inserir alunos.");

        // Criação de Transações
        const transactionsToInsert = insertedStudents.map(student => {
          const originalData = chunk.find(s => s.Nome === student.name);
          if (!originalData || originalData.monthly_fee === undefined || originalData.monthly_fee <= 0) return null;
          
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
          if (transactionError) console.error("Erro transações:", transactionError);
        }
        
        totalSuccess += insertedStudents.length;
        const newProcessedCount = Math.min(i + chunk.length, studentsData.length);
        setProcessedCount(newProcessedCount);
        setProgress((newProcessedCount / studentsData.length) * 100);
      }

      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['studentStats'] });
      showSuccess(`${totalSuccess} alunos importados com sucesso!`);
      onOpenChange(false);

    } catch (error: any) {
      showError(error.message);
    } finally {
      resetState();
    }
  };

  // --- LÓGICA DE SMART PARSING ---
  // Esta função reconstrói linhas quebradas por vírgulas em endereços/dias
  const reconstructRow = (rawRow: string[]) => {
    // Indices padrão esperados:
    // 0:Nome, 1:Email, 2:Tel
    // ... [Endereço com vírgulas] ...
    // ... [Tel Resp], [Notas] ...
    // PIVÔ 1: Data Nascimento (DD/MM/AAAA)
    // ... [Dias com vírgulas] ...
    // ... [Hora], [Plano] ...
    // PIVÔ 2: Valor Pago (Numérico)
    
    if (rawRow.length < 5) return null; // Linha lixo

    const name = rawRow[0];
    // Se nome estiver vazio ou for cabeçalho, pula
    if (!name || name.toLowerCase() === 'nome') return null;

    // Encontrar indice da Data de Nascimento (Pivô 1)
    const dateRegex = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/;
    // Procura a data entre o indice 4 e o fim (para evitar falsos positivos no inicio)
    let dobIndex = -1;
    for (let i = 3; i < rawRow.length; i++) {
      if (dateRegex.test(rawRow[i])) {
        dobIndex = i;
        break;
      }
    }

    // Se não achou data, tenta achar pelo valor pago (Pivô 2)
    // Regex para valor: 230.00 ou 230,00 (pode ter R$)
    const moneyRegex = /^\d+([.,]\d{1,2})?$/;
    let priceIndex = -1;
    
    // Começa a procurar o preço depois da data (se existir) ou do meio
    const startPriceSearch = dobIndex > -1 ? dobIndex + 1 : 5;
    for (let i = startPriceSearch; i < rawRow.length; i++) {
        // Limpa string para testar regex numérico
        const cleanVal = rawRow[i].replace(/[R$\s]/g, '');
        if (moneyRegex.test(cleanVal) && rawRow[i].length < 10) { // length < 10 evita pegar telefones
             priceIndex = i;
             break;
        }
    }

    // --- RECONSTRUÇÃO DO BLOCO 1: ENDEREÇO / RESPONSAVEL / NOTAS ---
    let address = "";
    let guardianPhone = "";
    let notes = "";
    
    if (dobIndex > -1) {
        // Pegamos tudo entre Telefone(idx 2) e Data(idx dobIndex)
        // Normal: [3]=End, [4]=Resp, [5]=Notas, [6]=DOB -> dobIndex=6. Length=6-3=3 itens.
        // Quebrado: [3]=Rua, [4]=N 30, [5]=Apto, [6]=Resp, [7]=Notas, [8]=DOB -> dobIndex=8.
        
        const chunk = rawRow.slice(3, dobIndex);
        
        // Lógica reversa: O último item do chunk é Notas, o penúltimo é Tel Resp, o resto é Endereço.
        // Mas Tel Resp e Notas podem estar vazios.
        
        if (chunk.length > 0) {
            // Verifica se o ultimo elemento parece um telefone ou é vazio
            let lastItem = chunk[chunk.length - 1];
            let secondLastItem = chunk.length > 1 ? chunk[chunk.length - 2] : "";

            // Helper simples para identificar telefone (tem numeros e hifens ou espaços, > 7 chars)
            const isPhone = (s: string) => s.replace(/\D/g, '').length > 8;
            
            if (isPhone(lastItem)) {
                // Caso: Endereco..., TelefoneResp (Notas vazio)
                guardianPhone = lastItem;
                address = chunk.slice(0, -1).join(", ");
            } else if (isPhone(secondLastItem)) {
                 // Caso: Endereco..., TelefoneResp, Notas
                 notes = lastItem;
                 guardianPhone = secondLastItem;
                 address = chunk.slice(0, -2).join(", ");
            } else {
                 // Caso: Tudo é endereço OU Endereço + Notas (sem telefone)
                 // Assumimos que o ultimo campo é nota se for muito longo e o anterior for curto? 
                 // Simplificação: Assume ultimo como nota se chunk > 1, senão tudo endereço.
                 // No seu CSV Real, Notas geralmente é vazio ou texto curto.
                 // Vamos tentar juntar tudo no endereço se não achou telefone, é mais seguro para evitar perda.
                 // Mas se tivermos notas como "não vem dia X", isso vai pro endereço. Aceitável.
                 // Ajuste fino baseado no seu CSV Real: 
                 // Notas é sempre a coluna antes da data. Telefone Resp antes da nota.
                 notes = lastItem;
                 // Verifica se penultimo é telefone
                 if (chunk.length > 1 && isPhone(secondLastItem)) {
                    guardianPhone = secondLastItem;
                    address = chunk.slice(0, -2).join(" ");
                 } else {
                    // Sem telefone responsavel identificado
                    address = chunk.slice(0, -1).join(" "); 
                 }
            }
        }
    } else {
        // Fallback se não achou data: Pega indice 3 como endereço
        address = rawRow[3];
    }

    // --- RECONSTRUÇÃO DO BLOCO 2: DIAS / HORARIO / PLANO ---
    let preferredDays = "";
    let preferredTime = "";
    let plan = "";

    if (dobIndex > -1 && priceIndex > -1) {
        // Tudo entre Data e Valor
        const middleChunk = rawRow.slice(dobIndex + 1, priceIndex);
        // Ex: [monday, tuesday, 19:00, 3x Mensal]
        
        if (middleChunk.length > 0) {
            plan = middleChunk[middleChunk.length - 1]; // Ultimo é o plano
            
            if (middleChunk.length > 1) {
                // Penultimo pode ser hora?
                const possibleTime = middleChunk[middleChunk.length - 2];
                if (validateTime(possibleTime)) {
                    preferredTime = possibleTime;
                    // O resto são dias
                    preferredDays = middleChunk.slice(0, -2).join(",");
                } else {
                    // Sem hora ou hora inválida, tudo antes do plano são dias
                    preferredDays = middleChunk.slice(0, -1).join(",");
                }
            }
        }
    } else {
        // Fallback posicional relativo ao valor pago (se data falhou mas preço achou)
        if (priceIndex > -1) {
             plan = rawRow[priceIndex - 1];
        }
    }

    // Extrair campos fixos finais (Assumindo que depois do Valor vem Forma Pgto, Status, Vencimento...)
    // Mas o CSV Real tem: Valor, FormaPgto, Status, Vencimento, Validade, TipoMatricula, Desconto
    // Se houve deslocamento antes do Valor, indices relativos ao priceIndex funcionam.
    
    const getRel = (offset: number) => priceIndex > -1 ? rawRow[priceIndex + offset] : "";

    // Montar objeto final limpo
    const planString = plan || "";
    const planParts = planString.trim().split(/\s+/); // Separa "2x" de "Mensal"
    const plan_frequency = planParts.find(p => p.toLowerCase().includes('x') || p.toLowerCase().includes('z'))?.replace('z', 'x') || null;
    
    return {
        Nome: rawRow[0],
        Email: rawRow[1],
        Telefone: rawRow[2],
        Endereco: address.replace(/^,|,$/g, '').trim(), // Remove virgulas das pontas
        'Telefone Responsavel': guardianPhone,
        Notas: notes,
        'Data Nascimento': parseDate(rawRow[dobIndex]),
        'Dias Preferidos': preferredDays,
        'Horario Preferido': preferredTime,
        Plano: planString,
        'Valor pago': priceIndex > -1 ? rawRow[priceIndex] : "0",
        'Forma de pagamento': getRel(1),
        Status: getRel(2),
        'Data de vencimento': parseDate(getRel(3)),
        Validade: parseDate(getRel(4)),
        enrollment_type: getRel(5),
        'Descricao Desconto': getRel(6), // Pode estar deslocado se houver mais colunas no fim, mas ok
        
        // Campos calculados
        monthly_fee: parseCurrency(priceIndex > -1 ? rawRow[priceIndex] : "0"),
        plan_type: planParts.filter(p => !p.includes('x') && !p.includes('z')).join(" ") || 'Avulso',
        plan_frequency,
    };
  };

  const handleFileUpload = () => {
    if (!csvFile) {
      showError("Por favor, selecione um arquivo CSV.");
      return;
    }

    Papa.parse(csvFile, {
      header: false, // IMPORTANTE: Ler como Array de Arrays para ignorar cabeçalhos quebrados
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        try {
            // Ignora a primeira linha (cabeçalho)
            const rawData = results.data.slice(1) as string[][];
            
            const processedData = rawData.map((row, index) => {
                try {
                    return reconstructRow(row);
                } catch (e) {
                    console.error(`Erro linha ${index}`, e);
                    return null;
                }
            }).filter(Boolean); // Remove nulos

            if (processedData.length === 0) {
                showError("Nenhum dado válido encontrado.");
                return;
            }

            processAndImportData(processedData);

        } catch (error: any) {
          showError(`Erro processando dados: ${error.message}`);
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
            O sistema tentará corrigir automaticamente endereços e listas de dias que contenham vírgulas.
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
            {isProcessing ? 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentCSVUploader;