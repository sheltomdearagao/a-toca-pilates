import React, { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, addDays, isAfter, differenceInDays } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Student } from '@/types/student';
import { showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess } from '@/utils/toast';
import { formatCurrency } from '@/utils/formatters';
import { Card } from '@/components/ui/card';

type PriceTable = {
  [planType: string]: {
    [frequency: string]: {
      [method: string]: number;
    };
  };
};

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Segunda' },
  { value: 'tuesday', label: 'Terça' },
  { value: 'wednesday', label: 'Quarta' },
  { value: 'thursday', label: 'Quinta' },
  { value: 'friday', label: 'Sexta' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

// Horários de 06:00 a 21:00
const AVAILABLE_HOURS = Array.from({ length: 16 }, (_, i) => {
  const h = 6 + i;
  return `${h.toString().padStart(2, '0')}:00`;
});

const VALIDITY_DURATIONS = [
  { value: 1, label: '1 Dia' },
  { value: 7, label: '7 Dias' },
  { value: 15, label: '15 Dias' },
  { value: 30, label: '30 Dias' },
  { value: 60, label: '60 Dias' },
  { value: 90, label: '90 Dias' },
];

// Função de pré-processamento segura para números
const safeNumberPreprocess = (val: unknown) => {
  if (typeof val === 'string' && val.trim() === '') return undefined;
  if (typeof val === 'string') return parseFloat(val.replace(',', '.'));
  return val;
};

const createStudentSchema = (appSettings: any) => {
  const planTypes = appSettings?.plan_types as [string, ...string[]] || ['Avulso'];
  const frequencies = appSettings?.plan_frequencies as [string, ...string[]] || ['2x'];
  const methods = appSettings?.payment_methods as [string, ...string[]] || ['Espécie'];
  const enrollTypes = appSettings?.enrollment_types as [string, ...string[]] || ['Particular', 'Wellhub', 'TotalPass'];

  return z.object({
    name: z.string().min(3, 'Nome obrigatório'),
    email: z.string().optional().nullable().transform(e => e?.trim() === '' ? null : e).refine(e => !e || z.string().email().safeParse(e).success, {
      message: 'Email inválido',
    }),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    guardian_phone: z.string().optional().nullable(),
    status: z.enum(['Ativo', 'Inativo', 'Experimental', 'Bloqueado']),
    notes: z.string().optional().nullable(),

    plan_type: z.enum(planTypes),
    enrollment_type: z.enum(enrollTypes),

    // Campos Condicionais
    plan_frequency: z.enum(frequencies).optional().nullable(),
    payment_method: z.enum(methods).optional().nullable(),
    monthly_fee: z.preprocess(
      safeNumberPreprocess,
      z.number().min(0, 'Mensalidade inválida')
    ),
    due_day: z.preprocess(
      safeNumberPreprocess,
      z.number().min(1).max(31).default(5)
    ),
    payment_date: z.string().optional().nullable(),
    validity_duration: z.preprocess(
      safeNumberPreprocess,
      z.number().optional().nullable()
    ),
    is_pro_rata_waived: z.boolean().optional(),

    date_of_birth: z.string().optional().nullable(),
    preferred_days: z.array(z.string()).optional().nullable(),
    preferred_time: z.string().optional().nullable(),
    has_promotional_value: z.boolean().optional(),
    discount_description: z.string().optional().nullable(),
  }).superRefine((data, ctx) => {
    const isParticular = data.enrollment_type === 'Particular';
    const isRecorrente = data.plan_type !== 'Avulso';
    const requiresValidityControl = isParticular && isRecorrente;

    if (isParticular && isRecorrente) {
      if (!data.plan_frequency) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Frequência obrigatória', path: ['plan_frequency'] });
      if (!data.payment_method) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Método de pagamento obrigatório', path: ['payment_method'] });
    }
    
    if (data.has_promotional_value && (!data.discount_description || data.discount_description.trim() === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Descrição do desconto obrigatória', path: ['discount_description'] });
    }
    
    if (requiresValidityControl) {
      if (!data.payment_date || data.payment_date.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data de pagamento obrigatória para controle de validade.', path: ['payment_date'] });
      }
      if (!data.validity_duration) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duração da validade obrigatória para controle de validade.', path: ['validity_duration'] });
      }
    }
  });
};

type FormData = z.infer<ReturnType<typeof createStudentSchema>>;

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudent: Student | null;
  onSubmit: (data: FormData) => void;
  isSubmitting: boolean;
}

const AddEditStudentDialog = ({ isOpen, onOpenChange, selectedStudent, onSubmit, isSubmitting }: Props) => {
  const { data: appSettings, isLoading: settingsLoading } = useAppSettings();
  
  // Fix: Define schema after appSettings is available
  const schema = React.useMemo(() => {
    if (!appSettings) return z.object({});
    return createStudentSchema(appSettings);
  }, [appSettings]);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', email: '', phone: '', address: '', guardian_phone: '',
      status: 'Ativo', notes: '',
      plan_type: 'Avulso', plan_frequency: null, payment_method: null, monthly_fee: 0,
      enrollment_type: 'Particular',
      date_of_birth: null,
      preferred_days: [], preferred_time: null,
      has_promotional_value: false, discount_description: null,
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      validity_duration: 30,
      due_day: 5,
      is_pro_rata_waived: false,
    },
  });

  const planType = watch('plan_type');
  const planFrequency = watch('plan_frequency');
  const paymentMethod = watch('payment_method');
  const hasPromo = watch('has_promotional_value');
  const enrollmentType = watch('enrollment_type');
  const validityDuration = watch('validity_duration');
  const dueDay = watch('due_day');
  const isProRataWaived = watch('is_pro_rata_waived');
  const paymentDate = watch('payment_date');
  const monthlyFee = watch('monthly_fee');

  const isParticular = enrollmentType === 'Particular';
  const requiresValidityControl = isParticular && planType !== 'Avulso';

  // Estado para armazenar valores calculados
  const [planValue, setPlanValue] = useState<number | null>(null);
  const [proRataValue, setProRataValue] = useState<number | null>(null);
  const [cycleStartDate, setCycleStartDate] = useState<Date | null>(null);
  const [planEndDate, setPlanEndDate] = useState<Date | null>(null);

  // Cálculo de datas e valores
  const { proRataDays, proRataAmount } = useMemo(() => {
    if (!paymentDate || !validityDuration || !planValue || !isParticular) return { proRataDays: 0, proRataAmount: 0 };
    
    const startDate = parseISO(paymentDate);
    const dueDayValue = dueDay;
    
    // Calcular a próxima data de vencimento
    let cycleStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), dueDayValue);
    
    // Se a data de vencimento já passou neste mês, vamos para o próximo mês
    if (cycleStartDate < startDate) {
      cycleStartDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, dueDayValue);
    }
    
    // Calcular a data de término do plano
    const endDate = addDays(cycleStartDate, validityDuration);
    
    // Calcular o número de dias para o proporcional
    const proRataDays = differenceInDays(cycleStartDate, startDate);
    const proRataAmount = (proRataDays / validityDuration) * planValue;
    
    setCycleStartDate(cycleStartDate);
    setPlanEndDate(endDate);
    
    return { proRataDays, proRataAmount };
  }, [paymentDate, validityDuration, planValue, dueDay, isParticular]);

  useEffect(() => {
    if (!appSettings?.price_table) return;
    
    // Se não for Particular, zera tudo relacionado a preço
    if (!isParticular || planType === 'Avulso') {
      setValue('monthly_fee', 0);
      setPlanValue(0);
      return;
    }
    
    if (hasPromo) return;
    
    const table: PriceTable = appSettings.price_table;
    const freqMap = table[planType]?.[planFrequency ?? ''];
    const price = freqMap?.[paymentMethod ?? ''];
    if (price != null) {
      setValue('monthly_fee', price);
      setPlanValue(price);
    }
  }, [planType, planFrequency, paymentMethod, hasPromo, enrollmentType, appSettings, setValue, isParticular]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedStudent) {
      reset({
        name: selectedStudent.name,
        email: selectedStudent.email,
        phone: selectedStudent.phone,
        address: selectedStudent.address,
        guardian_phone: selectedStudent.guardian_phone,
        status: selectedStudent.status,
        notes: selectedStudent.notes,
        plan_type: selectedStudent.plan_type,
        plan_frequency: selectedStudent.plan_frequency,
        payment_method: selectedStudent.payment_method,
        monthly_fee: selectedStudent.monthly_fee ?? 0,
        enrollment_type: selectedStudent.enrollment_type,
        date_of_birth: selectedStudent.date_of_birth ? format(parseISO(selectedStudent.date_of_birth), 'yyyy-MM-dd') : null,
        
        preferred_days: selectedStudent.preferred_days || [],
        preferred_time: selectedStudent.preferred_time || null,
        has_promotional_value: !!selectedStudent.discount_description,
        discount_description: selectedStudent.discount_description || null,
        
        // Usamos a data de validade existente para preencher a data de pagamento no modo edição
        payment_date: selectedStudent.validity_date ? format(parseISO(selectedStudent.validity_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        validity_duration: 30, // Mantemos 30 como default para edição
        due_day: selectedStudent.due_day ?? 5, // Usar due_day existente ou default
        is_pro_rata_waived: false,
      });
    } else {
      reset({
        name: '', email: '', phone: '', address: '', guardian_phone: '',
        status: 'Ativo', notes: '',
        plan_type: 'Avulso', plan_frequency: null, payment_method: null, monthly_fee: 0,
        enrollment_type: 'Particular',
        date_of_birth: null,
        preferred_days: [], preferred_time: null,
        has_promotional_value: false, discount_description: null,
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        validity_duration: 30,
        due_day: 5,
        is_pro_rata_waived: false,
      });
    }
  }, [isOpen, selectedStudent, reset]);

  const handleFormSubmit = async (data: FormData) => {
    // Passo 1: Recuperar o usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showError('Usuário não autenticado.');
      return;
    }

    // Verificar se é modo edição
    if (selectedStudent) {
      // Modo Edição: Atualizar apenas o aluno
      const studentData = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        guardian_phone: data.guardian_phone,
        status: data.status,
        notes: data.notes,
        // Não incluir campos de plano, pois não queremos alterar a assinatura
      };

      try {
        const { error: updateError } = await supabase
          .from('students')
          .update(studentData)
          .eq('id', selectedStudent.id);

        if (updateError) throw new Error(`Erro ao atualizar aluno: ${updateError.message}`);

        showSuccess('Cadastro atualizado com sucesso!');
        onOpenChange(false);
      } catch (error: any) {
        showError(error.message);
      }
    } else {
      // Modo Criação: Implementando rollback
      // Passo 2: Preparação e Cálculos
      const studentData = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        guardian_phone: data.guardian_phone,
        status: data.status,
        notes: data.notes,
        plan_type: data.plan_type,
        plan_frequency: data.plan_frequency,
        payment_method: data.payment_method,
        monthly_fee: data.monthly_fee,
        enrollment_type: data.enrollment_type,
        date_of_birth: data.date_of_birth,
        preferred_days: data.preferred_days,
        preferred_time: data.preferred_time,
        discount_description: data.discount_description,
        due_day: data.due_day, // Garantindo que é número
        user_id: user.id, // Adicionando user_id
      };

      // Calcular end_date da assinatura
      const paymentDateStr = data.payment_date || format(new Date(), 'yyyy-MM-dd');
      const paymentDate: Date = parseISO(paymentDateStr); // Garantindo que é Date
      const validityDuration = data.validity_duration || 30;
      const endDate = addDays(paymentDate, validityDuration);
      
      // Passo 3: Salvar Aluno (students) com rollback
      let newStudent = null;
      try {
        const { data: newStudentTemp, error: studentError } = await supabase
          .from('students')
          .insert(studentData)
          .select()
          .single();

        if (studentError) throw new Error(`Erro ao criar aluno: ${studentError.message}`);
        newStudent = newStudentTemp;

        // Passo 4: Salvar Assinatura (subscriptions)
        const isParticular = data.enrollment_type === 'Particular';
        
        const { data: planData, error: planError } = await supabase
          .from('plans')
          .select('id')
          .eq('name', data.plan_type)
          .single();

        let planId = planData?.id;
        if (!planId) {
          // Se o plano não existir, criar um novo
          const { data: newPlan, error: createPlanError } = await supabase
            .from('plans')
            .insert({
              name: data.plan_type,
              frequency: data.plan_frequency ? parseInt(data.plan_frequency) : 0,
              default_price: data.monthly_fee,
              active: true
            })
            .select()
            .single();
          
          if (createPlanError) throw new Error(`Erro ao criar plano: ${createPlanError.message}`);
          
          planId = newPlan.id;
        }

        // Configurações da Assinatura
        let subscriptionPrice = data.monthly_fee || 0;
        let subscriptionDueDay = data.due_day || null;
        let subscriptionEndDate = planEndDate?.toISOString() || endDate.toISOString();

        if (!isParticular) {
          // Wellhub/TotalPass: Preços e vencimentos zerados/nulos
          subscriptionPrice = 0;
          subscriptionDueDay = null;
          subscriptionEndDate = null;
        }

        // Criar a assinatura
        const { data: newSubscription, error: subscriptionError } = await supabase
          .from('subscriptions')
          .insert({
            student_id: newStudent.id,
            plan_id: planId,
            price: subscriptionPrice, // Valor do plano recorrente (0 para parceiros)
            frequency: data.plan_frequency ? parseInt(data.plan_frequency) : 0,
            start_date: paymentDate.toISOString(), // Correção: paymentDate é Date
            end_date: subscriptionEndDate,
            due_day: subscriptionDueDay, // Garantindo que é número ou null
            status: 'active'
          })
          .select()
          .single();

        if (subscriptionError) throw new Error(`Erro ao criar assinatura: ${subscriptionError.message}`);

        // Passo 5: Lançar no Financeiro (financial_transactions) - APENAS SE FOR PARTICULAR
        if (isParticular) {
          const proRataAmountFinal = isProRataWaived ? 0 : (proRataDays / validityDuration) * (planValue || 0);
          const totalAmount = proRataAmountFinal + (planValue || 0);

          const { error: transactionError } = await supabase
            .from('financial_transactions')
            .insert({
              user_id: user.id,
              student_id: newStudent.id,
              subscription_id: newSubscription.id,
              amount: totalAmount,
              payment_method: data.payment_method,
              paid_at: paymentDate.toISOString(), // Correção: paymentDate é Date
              description: `Matrícula: Ajuste Proporcional + Plano ${data.plan_type} ${data.plan_frequency || ''}`,
              type: 'revenue',
              status: 'paid',
              category: 'Mensalidade'
            });

          if (transactionError) throw new Error(`Erro ao criar lançamento financeiro: ${transactionError.message}`);
        }

        // Sucesso
        showSuccess('Aluno salvo com sucesso!');
        onOpenChange(false);
      } catch (error: any) {
        // Rollback: Excluir aluno se já foi criado
        if (newStudent) {
          try {
            await supabase.from('students').delete().eq('id', newStudent.id);
          } catch (rollbackError) {
            console.error('Erro ao excluir aluno durante rollback:', rollbackError);
          }
        }
        showError(error.message);
      }
    }
  };

  const handleFormError = (validationErrors: any) => {
    const firstErrorKey = Object.keys(validationErrors)[0];
    if (firstErrorKey) {
      const error = validationErrors[firstErrorKey];
      const message = Array.isArray(error) ? error[0].message : error.message;
      showError(`Preencha o campo: ${message}`);
    }
  };

  if (settingsLoading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selectedStudent ? 'Editar Aluno' : 'Novo Aluno'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit, handleFormError)}>
          <div className="grid gap-4 py-4">
            {/* Dados Pessoais */}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Controller name="name" control={control} render={({ field }) => <Input {...field} />} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email (Opcional)</Label>
                <Controller name="email" control={control} render={({ field }) => <Input {...field} />} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Telefone (Opcional)</Label>
                <Controller name="phone" control={control} render={({ field }) => <Input {...field} />} />
              </div>
            </div>
            
            {/* Endereço (agora acima do número do responsável) */}
            <div className="space-y-2">
              <Label>Endereço (Opcional)</Label>
              <Controller name="address" control={control} render={({ field }) => <Input {...field} />} />
            </div>
            
            {/* Número do responsável (agora abaixo do telefone) */}
            <div className="space-y-2">
              <Label>Telefone Responsável (Opcional)</Label>
              <Controller name="guardian_phone" control={control} render={({ field }) => <Input {...field} />} />
            </div>
            
            <div className="space-y-2">
              <Label>Notas (Opcional)</Label>
              <Controller name="notes" control={control} render={({ field }) => <Textarea {...field} />} />
            </div>
            
            {/* Data Nasc. (Ajustado para ficar abaixo de Notas) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Nasc. (Opcional)</Label>
                <Controller name="date_of_birth" control={control} render={({ field }) => <Input type="date" {...field} />} />
              </div>
            </div>
            
            {/* Status do Aluno e Tipo de Matrícula */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status do Aluno</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                      <SelectItem value="Experimental">Experimental</SelectItem>
                      <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
                {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Tipo de Matrícula</Label>
                <Controller name="enrollment_type" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {appSettings?.enrollment_types.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            {/* Se for Wellhub/TotalPass, mostra alerta e pula campos de pagamento */}
            {!isParticular && (
              <Card className="col-span-full p-4 bg-yellow-50/50 border-yellow-300 text-yellow-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm font-medium">
                    Alunos {enrollmentType}: O pagamento é processado externamente pela operadora. Nenhuma cobrança será gerada neste sistema.
                  </p>
                </div>
              </Card>
            )}

            {/* Campos de Plano e Pagamento (Apenas para Particulares) */}
            {isParticular && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Plano</Label>
                    <Controller name="plan_type" control={control} render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {appSettings?.plan_types.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Controller name="plan_frequency" control={control} render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || ''} disabled={planType === 'Avulso'}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {appSettings?.plan_frequencies.map(fq => <SelectItem key={fq} value={fq}>{fq}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                    {errors.plan_frequency && <p className="text-sm text-destructive">{errors.plan_frequency.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Pagamento</Label>
                    <Controller name="payment_method" control={control} render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || ''} disabled={planType === 'Avulso'}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {appSettings?.payment_methods.map(pm => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                    {errors.payment_method && <p className="text-sm text-destructive">{errors.payment_method.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mensalidade (R$)</Label>
                  <Controller name="monthly_fee" control={control} render={({ field }) => <Input type="number" step="0.01" {...field} />} />
                  {errors.monthly_fee && <p className="text-sm text-destructive">{errors.monthly_fee.message}</p>}
                </div>
              </>
            )}

            {/* Datas de Vencimento (Apenas para Particulares Recorrentes) */}
            {requiresValidityControl && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dia de Vencimento</Label>
                  <Controller name="due_day" control={control} render={({ field }) => (
                    <Select onValueChange={(value) => setValue('due_day', parseInt(value))} value={field.value.toString()}>
                      <SelectTrigger><SelectValue placeholder="Selecione o dia" /></SelectTrigger>
                      <SelectContent>
                        {[5, 10, 15, 20, 25, 30].map(day => (
                          <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
            )}

            {/* Preferências de Dia/Horário */}
            <div className="space-y-2">
              <Label>Dias Preferidos (Opcional)</Label>
              <Controller name="preferred_days" control={control} render={({ field }) => (
                <ToggleGroup type="multiple" value={field.value || []} onValueChange={field.onChange} className="grid grid-cols-4 gap-2">
                  {DAYS_OF_WEEK.map(d => (
                    <ToggleGroupItem key={d.value} value={d.value} className={cn("px-2 py-1 rounded", field.value?.includes(d.value) ? "bg-primary text-white" : "bg-muted")}>
                      {d.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )} />
            </div>
            <div className="space-y-2">
              <Label>Horário Preferido (Opcional)</Label>
              <Controller name="preferred_time" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <SelectTrigger><SelectValue placeholder="Selecione o horário" /></SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_HOURS.map(hr => <SelectItem key={hr} value={hr}>{hr}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>

            {/* Promoções */}
            <div className="flex items-center space-x-2">
              <Controller name="has_promotional_value" control={control} render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!isParticular} />
              )} />
              <Label>Valor Promocional</Label>
            </div>
            {watch('has_promotional_value') && (
              <div className="space-y-2">
                <Label>Descrição do Desconto</Label>
                <Controller name="discount_description" control={control} render={({ field }) => <Input {...field} />} />
              </div>
            )}
            
            {/* Controle de Validade */}
            {requiresValidityControl && (
              <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
                <div className="space-y-2">
                  <Label>Data do Pagamento</Label>
                  <Controller name="payment_date" control={control} render={({ field }) => <Input type="date" {...field} />} />
                  {errors.payment_date && <p className="text-sm text-destructive">{errors.payment_date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Duração da Validade</Label>
                  <Controller name="validity_duration" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={String(field.value || 30)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VALIDITY_DURATIONS.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                  {errors.validity_duration && <p className="text-sm text-destructive">{errors.validity_duration.message}</p>}
                </div>
              </div>
            )}

            {/* Card de Pagamento */}
            {planValue && proRataAmount && requiresValidityControl && planType !== 'Avulso' && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Ajuste Proporcional (de {format(parseISO(paymentDate), 'dd/MM')} a {format(cycleStartDate || new Date(), 'dd/MM')}):</span>
                  <span className="font-bold text-primary">
                    {isProRataWaived ? 'Isento' : formatCurrency(proRataAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Plano ({format(cycleStartDate || new Date(), 'dd/MM')} a {format(planEndDate || new Date(), 'dd/MM')}):</span>
                  <span className="font-bold text-primary">{formatCurrency(planValue)}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total a Pagar:</span>
                  <span className="text-primary">
                    {isProRataWaived ? formatCurrency(planValue) : formatCurrency(proRataAmount + planValue)}
                  </span>
                </div>
                <div className="mt-2 flex items-center space-x-2">
                  <Controller name="is_pro_rata_waived" control={control} render={({ field }) => (
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  )} />
                  <Label>Isentar Ajuste Proporcional</Label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedStudent ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditStudentDialog;