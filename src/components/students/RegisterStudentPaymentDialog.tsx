import React, { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
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
import { Student } from '@/types/student';
import { showError, showSuccess } from '@/utils/toast';
import { formatCurrency } from '@/utils/formatters';
import { Card } from '@/components/ui/card';
import { useStudentFinancialIntegration } from '@/hooks/useStudentFinancialIntegration';

type PriceTable = {
  [planType: string]: {
    [frequency: string]: {
      [method: string]: number;
    };
  };
};

const VALIDITY_DURATIONS = [
  { value: 1, label: '1 Dia' },
  { value: 7, label: '7 Dias' },
  { value: 15, label: '15 Dias' },
  { value: 30, label: '30 Dias' },
  { value: 60, label: '60 Dias' },
  { value: 90, label: '90 Dias' },
];

const safeNumberPreprocess = (val: unknown) => {
  if (typeof val === 'string' && val.trim() === '') return undefined;
  if (typeof val === 'string') return parseFloat(val.replace(',', '.'));
  return val;
};

const createPaymentSchema = (appSettings: any) => {
  const planTypes = appSettings?.plan_types as [string, ...string[]] || ['Avulso'];
  const frequencies = appSettings?.plan_frequencies as [string, ...string[]] || ['2x'];
  const methods = appSettings?.payment_methods as [string, ...string[]] || ['Espécie'];

  return z.object({
    plan_type: z.enum(planTypes),
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
    payment_date: z.string().min(1, 'Data de pagamento é obrigatória.'),
    validity_duration: z.preprocess(
      safeNumberPreprocess,
      z.number().min(1, 'Duração da validade é obrigatória.')
    ),
    has_promotional_value: z.boolean().optional(),
    discount_description: z.string().optional().nullable(),
    is_pro_rata_waived: z.boolean().optional(),
  }).superRefine((data, ctx) => {
    const isRecorrente = data.plan_type !== 'Avulso';

    if (isRecorrente) {
      if (!data.plan_frequency) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Frequência obrigatória', path: ['plan_frequency'] });
      if (!data.payment_method) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Método de pagamento obrigatório', path: ['payment_method'] });
    }
    
    if (data.has_promotional_value && (!data.discount_description || data.discount_description.trim() === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Descrição do desconto obrigatória', path: ['discount_description'] });
    }
  });
};

type PaymentFormData = z.infer<ReturnType<typeof createPaymentSchema>>;

interface RegisterStudentPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | undefined;
}

const RegisterStudentPaymentDialog = ({ isOpen, onOpenChange, student }: RegisterStudentPaymentDialogProps) => {
  const { data: appSettings, isLoading: settingsLoading } = useAppSettings();
  const { registerStudentPayment } = useStudentFinancialIntegration();

  const schema = React.useMemo(() => {
    if (!appSettings) return z.object({});
    return createPaymentSchema(appSettings);
  }, [appSettings]);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      plan_type: 'Avulso',
      plan_frequency: null,
      payment_method: null,
      monthly_fee: 0,
      due_day: 5,
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      validity_duration: 30,
      has_promotional_value: false,
      discount_description: null,
      is_pro_rata_waived: false,
    },
  });

  const planType = watch('plan_type');
  const planFrequency = watch('plan_frequency');
  const paymentMethod = watch('payment_method');
  const hasPromo = watch('has_promotional_value');
  const validityDuration = watch('validity_duration');
  const dueDay = watch('due_day');
  const isProRataWaived = watch('is_pro_rata_waived');
  const paymentDate = watch('payment_date');
  const monthlyFee = watch('monthly_fee');

  const isRecorrente = planType !== 'Avulso';

  const [planValue, setPlanValue] = useState<number | null>(null);
  const [cycleStartDate, setCycleStartDate] = useState<Date | null>(null);
  const [planEndDate, setPlanEndDate] = useState<Date | null>(null);

  // Cálculo de datas e valores
  const { proRataDays, proRataAmount } = useMemo(() => {
    if (!paymentDate || !validityDuration || !planValue) return { proRataDays: 0, proRataAmount: 0 };
    
    const startDate = parseISO(paymentDate);
    const dueDayValue = dueDay;
    
    let calculatedCycleStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), dueDayValue);
    
    if (calculatedCycleStartDate < startDate) {
      calculatedCycleStartDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, dueDayValue);
    }
    
    const endDate = addDays(calculatedCycleStartDate, validityDuration);
    
    const daysInPeriod = differenceInDays(calculatedCycleStartDate, startDate);
    const daysInFullCycle = validityDuration; // Assumindo que validity_duration é o número de dias do ciclo
    
    const dailyRate = planValue / daysInFullCycle;
    const calculatedProRataAmount = dailyRate * daysInPeriod;
    
    setCycleStartDate(calculatedCycleStartDate);
    setPlanEndDate(endDate);
    
    return { proRataDays: daysInPeriod, proRataAmount: parseFloat(calculatedProRataAmount.toFixed(2)) };
  }, [paymentDate, validityDuration, planValue, dueDay]);

  useEffect(() => {
    if (!appSettings?.price_table) return;
    
    if (planType === 'Avulso') {
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
  }, [planType, planFrequency, paymentMethod, hasPromo, appSettings, setValue]);

  useEffect(() => {
    if (isOpen && student) {
      reset({
        plan_type: student.plan_type || 'Avulso',
        plan_frequency: student.plan_frequency || null,
        payment_method: student.payment_method || null,
        monthly_fee: student.monthly_fee ?? 0,
        due_day: student.due_day ?? 5,
        payment_date: format(new Date(), 'yyyy-MM-dd'), // Default to today for new payment
        validity_duration: 30, // Default duration
        has_promotional_value: !!student.discount_description,
        discount_description: student.discount_description || null,
        is_pro_rata_waived: false,
      });
    } else if (!isOpen) {
      reset(); // Reset form when dialog closes
    }
  }, [isOpen, student, reset]);

  const handleFormSubmit = (data: PaymentFormData) => {
    if (!student?.id) {
      showError('Aluno não encontrado.');
      return;
    }

    const proRataAmountFinal = isProRataWaived ? 0 : proRataAmount;
    const totalAmount = proRataAmountFinal + (planValue || 0);

    registerStudentPayment.mutate({
      studentId: student.id,
      amount: totalAmount,
      planType: data.plan_type,
      frequency: data.plan_frequency || undefined,
      paymentMethod: data.payment_method || undefined,
      dueDate: cycleStartDate?.toISOString() || new Date().toISOString(), // Próximo vencimento
      paidAt: parseISO(data.payment_date).toISOString(), // Data de pagamento
      validityDays: data.validity_duration,
      description: `Mensalidade - ${data.plan_type} ${data.plan_frequency || ''} ${data.has_promotional_value ? '(Promo)' : ''}`,
      discountDescription: data.discount_description || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const handleFormError = (validationErrors: any) => {
    const firstErrorKey = Object.keys(validationErrors)[0];
    if (firstErrorKey) {
      const error = validationErrors[firstErrorKey];
      const message = Array.isArray(error) ? error[0].message : error.message;
      showError(`Preencha o campo: ${message}`);
    }
  };

  if (settingsLoading || !student) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento para {student.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit, handleFormError)}>
          <div className="grid gap-4 py-4">
            {/* Campos de Plano e Pagamento */}
            {student.enrollment_type === 'Particular' ? (
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
            ) : (
              <Card className="col-span-full p-4 bg-yellow-50/50 border-yellow-300 text-yellow-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm font-medium">
                    Alunos {student.enrollment_type}: O pagamento é processado externamente pela operadora. Nenhuma cobrança será gerada neste sistema.
                  </p>
                </div>
              </Card>
            )}

            {/* Datas de Vencimento (Apenas para Particulares Recorrentes) */}
            {student.enrollment_type === 'Particular' && isRecorrente && (
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

            {/* Promoções */}
            {student.enrollment_type === 'Particular' && (
              <div className="flex items-center space-x-2">
                <Controller name="has_promotional_value" control={control} render={({ field }) => (
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                )} />
                <Label>Valor Promocional</Label>
              </div>
            )}
            {watch('has_promotional_value') && (
              <div className="space-y-2">
                <Label>Descrição do Desconto</Label>
                <Controller name="discount_description" control={control} render={({ field }) => <Input {...field} />} />
              </div>
            )}
            
            {/* Controle de Validade */}
            {student.enrollment_type === 'Particular' && isRecorrente && (
              <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
                <div className="space-y-2">
                  <Label>Data do Pagamento</Label>
                  <Controller name="payment_date" control={control} render={({ field }) => <Input type="date" {...field} />} />
                  {errors.payment_date && <p className="text-sm text-destructive">{errors.payment_date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Duração da Validade</Label>
                  <Controller name="validity_duration" control={control} render={({ field }) => (
                    <Select onValueChange={(value) => setValue('validity_duration', parseInt(value))} value={String(field.value || 30)}>
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
            {planValue !== null && isRecorrente && student.enrollment_type === 'Particular' && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Ajuste Proporcional (de {paymentDate ? format(parseISO(paymentDate), 'dd/MM') : 'N/A'} a {cycleStartDate ? format(cycleStartDate, 'dd/MM') : 'N/A'}):</span>
                  <span className="font-bold text-primary">
                    {isProRataWaived ? 'Isento' : formatCurrency(proRataAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Plano ({cycleStartDate ? format(cycleStartDate, 'dd/MM') : 'N/A'} a {planEndDate ? format(planEndDate, 'dd/MM') : 'N/A'}):</span>
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
            <Button type="submit" disabled={registerStudentPayment.isPending}>
              {registerStudentPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RegisterStudentPaymentDialog;