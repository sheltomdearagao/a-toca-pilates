import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Student } from '@/types/student';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const pricingTable = {
  Mensal: {
    '2x': { 'Crédito': 245, 'Débito': 230, 'Pix': 230, 'Espécie': 230 },
    '3x': { 'Crédito': 275, 'Débito': 260, 'Pix': 260, 'Espécie': 260 },
    '4x': { 'Crédito': 300, 'Débito': 285, 'Pix': 285, 'Espécie': 285 },
    '5x': { 'Crédito': 320, 'Débito': 305, 'Pix': 305, 'Espécie': 305 },
  },
  Trimestral: {
    '2x': { 'Crédito': 225, 'Débito': 210, 'Pix': 210, 'Espécie': 210 },
    '3x': { 'Crédito': 255, 'Débito': 240, 'Pix': 240, 'Espécie': 240 },
    '4x': { 'Crédito': 285, 'Débito': 270, 'Pix': 270, 'Espécie': 270 },
    '5x': { 'Crédito': 300, 'Débito': 285, 'Pix': 285, 'Espécie': 285 },
  },
};

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Seg' },
  { value: 'tuesday', label: 'Ter' },
  { value: 'wednesday', label: 'Qua' },
  { value: 'thursday', label: 'Qui' },
  { value: 'friday', label: 'Sex' },
  { value: 'saturday', label: 'Sáb' },
];

const availableHours = Array.from({ length: 14 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});

interface AddEditStudentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedStudent: Student | null;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}

const createStudentSchema = (appSettings: any) => {
  const dynamicPlanTypeSchema = z.enum(appSettings?.plan_types as [string, ...string[]] || ["Avulso"]);
  const dynamicPlanFrequencySchema = z.enum(appSettings?.plan_frequencies as [string, ...string[]] || ["2x"]).optional().nullable();
  const dynamicPaymentMethodSchema = z.enum(appSettings?.payment_methods as [string, ...string[]] || ["Crédito"]).optional().nullable();
  const dynamicEnrollmentTypeSchema = z.enum(appSettings?.enrollment_types as [string, ...string[]] || ["Particular"]);

  return z.object({
    name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
    email: z.string().email("Email inválido.").optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    guardian_phone: z.string().optional().or(z.literal("")),
    status: z.enum(["Ativo", "Inativo", "Experimental", "Bloqueado"]),
    notes: z.string().optional().or(z.literal("")),
    plan_type: dynamicPlanTypeSchema.default("Avulso"),
    plan_frequency: dynamicPlanFrequencySchema,
    payment_method: dynamicPaymentMethodSchema,
    monthly_fee: z.preprocess(
      (val) => (typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val),
      z.number().optional()
    ),
    enrollment_type: dynamicEnrollmentTypeSchema.default("Particular"),
    date_of_birth: z.string().optional().nullable(),
    validity_date: z.string().optional().nullable(),
    preferred_days: z.array(z.string()).optional(),
    preferred_time: z.string().optional().nullable().refine(
      (val) => val === null || val === undefined || (typeof val === 'string' && val.endsWith(':00')),
      { message: "O horário deve ser em hora cheia (ex: 08:00)." }
    ),
    has_promotional_value: z.boolean().optional(),
    discount_description: z.string().optional().nullable(),
    register_payment: z.boolean().optional(),
    payment_due_date: z.string().optional().nullable(),
  }).superRefine((data, ctx) => {
    if (data.plan_type !== 'Avulso') {
      if (!data.plan_frequency) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A frequência é obrigatória.', path: ['plan_frequency'] });
      if (!data.payment_method) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'O método de pagamento é obrigatório.', path: ['payment_method'] });
      if (!data.monthly_fee || data.monthly_fee <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'O valor da mensalidade deve ser maior que zero.', path: ['monthly_fee'] });
    }
    if (data.has_promotional_value && (!data.discount_description || data.discount_description.trim() === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A descrição do desconto é obrigatória.', path: ['discount_description'] });
    }
    if (data.preferred_days && data.preferred_days.length > 0 && !data.preferred_time) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'O horário é obrigatório se os dias forem selecionados.', path: ['preferred_time'] });
    if (data.plan_frequency && data.preferred_days) {
      const expectedCount = parseInt(data.plan_frequency.replace('x', ''), 10);
      if (data.preferred_days.length > 0 && data.preferred_days.length !== expectedCount) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Selecione exatamente ${expectedCount} dias.`, path: ['preferred_days'] });
    }
    if (data.register_payment && data.plan_type !== 'Avulso') {
      if (!data.payment_due_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A data de vencimento do pagamento é obrigatória.', path: ['payment_due_date'] });
      }
    }
  });
};

type StudentFormData = z.infer<ReturnType<typeof createStudentSchema>>;

const AddEditStudentDialog = ({ isOpen, onOpenChange, selectedStudent, onSubmit, isSubmitting }: AddEditStudentDialogProps) => {
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const studentSchema = createStudentSchema(appSettings);

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: "", email: "", phone: "", address: "", guardian_phone: "", status: "Experimental", notes: "",
      plan_type: "Avulso", enrollment_type: "Particular", date_of_birth: null, validity_date: null,
      preferred_days: [], preferred_time: null, plan_frequency: null, payment_method: null,
      has_promotional_value: false, discount_description: null,
      register_payment: false,
      payment_due_date: null,
      monthly_fee: undefined,
    },
  });

  const planType = watch("plan_type");
  const planFrequency = watch("plan_frequency");
  const paymentMethod = watch("payment_method");
  const preferredDays = watch("preferred_days") || [];
  const hasPromotionalValue = watch("has_promotional_value");
  const registerPayment = watch("register_payment");

  const frequencyCount = planFrequency ? parseInt(planFrequency.replace('x', ''), 10) : 0;
  const canSelectMoreDays = preferredDays.length < frequencyCount || frequencyCount === 0;

  useEffect(() => {
    if (!hasPromotionalValue && planType && planType !== 'Avulso' && planFrequency && paymentMethod) {
      const fee = pricingTable[planType as keyof typeof pricingTable]?.[planFrequency as keyof typeof pricingTable['Mensal']]?.[paymentMethod as keyof typeof pricingTable['Mensal']['2x']] || 0;
      setValue('monthly_fee', fee);
    } else if (planType === 'Avulso') {
      setValue('monthly_fee', 0);
    }
  }, [planType, planFrequency, paymentMethod, hasPromotionalValue, setValue]);

  useEffect(() => {
    if (isOpen) {
      if (selectedStudent) {
        reset({
          ...selectedStudent,
          email: selectedStudent.email || '',
          phone: selectedStudent.phone || '',
          address: selectedStudent.address || '',
          guardian_phone: selectedStudent.guardian_phone || '',
          notes: selectedStudent.notes || '',
          date_of_birth: selectedStudent.date_of_birth ? format(new Date(selectedStudent.date_of_birth), 'yyyy-MM-dd') : null,
          validity_date: selectedStudent.validity_date ? format(new Date(selectedStudent.validity_date), 'yyyy-MM-dd') : null,
          preferred_days: selectedStudent.preferred_days || [],
          preferred_time: selectedStudent.preferred_time || null,
          plan_frequency: selectedStudent.plan_type === 'Avulso' ? null : selectedStudent.plan_frequency || null,
          payment_method: selectedStudent.plan_type === 'Avulso' ? null : selectedStudent.payment_method || null,
          has_promotional_value: !!selectedStudent.discount_description,
          discount_description: selectedStudent.discount_description || null,
          register_payment: false,
          payment_due_date: null,
          monthly_fee: selectedStudent.monthly_fee ?? undefined,
        });
      } else {
        reset({
          name: "", email: "", phone: "", address: "", guardian_phone: "", status: "Experimental", notes: "",
          plan_type: "Avulso", enrollment_type: "Particular", date_of_birth: null, validity_date: null,
          preferred_days: [], preferred_time: null, plan_frequency: null, payment_method: null,
          has_promotional_value: false, discount_description: null,
          register_payment: false,
          payment_due_date: null,
          monthly_fee: undefined,
        });
      }
    }
  }, [isOpen, selectedStudent, reset, appSettings]);

  if (isLoadingSettings) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-xl">{selectedStudent ? "Editar Aluno" : "Adicionar Novo Aluno"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Controller name="name" control={control} render={({ field, fieldState }) => (
                <>
                  <Input {...field} />
                  {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                </>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Controller name="email" control={control} render={({ field, fieldState }) => (
                  <>
                    <Input {...field} type="email" />
                    {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                  </>
                )} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Controller name="phone" control={control} render={({ field }) => <Input {...field} />} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Controller name="address" control={control} render={({ field }) => <Input {...field} />} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone Responsável</Label>
                <Controller name="guardian_phone" control={control} render={({ field }) => <Input {...field} />} />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Controller name="date_of_birth" control={control} render={({ field }) => <Input {...field} type="date" value={field.value || ''} />} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status do Aluno</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                      <SelectItem value="Experimental">Experimental</SelectItem>
                      <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Matrícula</Label>
                <Controller name="enrollment_type" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      {appSettings?.enrollment_types.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            <h3 className="text-lg font-semibold mt-4 border-t pt-4">Detalhes do Plano</h3>

            <div className="space-y-2">
              <Label>Tipo de Plano</Label>
              <Controller name="plan_type" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Tipo de Plano" /></SelectTrigger>
                  <SelectContent>
                    {appSettings?.plan_types.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>

            {planType !== 'Avulso' && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Controller name="plan_frequency" control={control} render={({ field, fieldState }) => (
                      <>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <SelectTrigger><SelectValue placeholder="Frequência" /></SelectTrigger>
                          <SelectContent>
                            {appSettings?.plan_frequencies.map(freq => (
                              <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                      </>
                    )} />
                  </div>
                  <div className="space-y-2">
                    <Label>Método Pagamento</Label>
                    <Controller name="payment_method" control={control} render={({ field, fieldState }) => (
                      <>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <SelectTrigger><SelectValue placeholder="Método" /></SelectTrigger>
                          <SelectContent>
                            {appSettings?.payment_methods.map(method => (
                              <SelectItem key={method} value={method}>{method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                      </>
                    )} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Validade</Label>
                    <Controller name="validity_date" control={control} render={({ field }) => <Input {...field} type="date" value={field.value || ''} />} />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Controller name="has_promotional_value" control={control} render={({ field }) => (
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="has_promotional_value" />
                  )} />
                  <Label htmlFor="has_promotional_value">Valor Promocional / Desconto</Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mensalidade (R$)</Label>
                    <Controller name="monthly_fee" control={control} render={({ field, fieldState }) => (
                      <>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          disabled={!hasPromotionalValue}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          value={field.value === undefined ? '' : field.value}
                        />
                        {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                      </>
                    )} />
                  </div>
                  {hasPromotionalValue && (
                    <div className="space-y-2">
                      <Label>Descrição do Desconto</Label>
                      <Controller name="discount_description" control={control} render={({ field, fieldState }) => (
                        <>
                          <Input {...field} value={field.value || ''} />
                          {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                        </>
                      )} />
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-semibold mt-4 border-t pt-4">Preferências de Agendamento</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Dias Preferidos ({preferredDays.length}/{frequencyCount})</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <Controller
                          key={day.value}
                          name="preferred_days"
                          control={control}
                          render={({ field }) => (
                            <Button
                              type="button"
                              variant={field.value?.includes(day.value) ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "transition-colors",
                                !canSelectMoreDays && !field.value?.includes(day.value) && "opacity-50 cursor-not-allowed"
                              )}
                              onClick={() => {
                                const isSelected = field.value?.includes(day.value);
                                if (isSelected) {
                                  field.onChange(field.value.filter(v => v !== day.value));
                                } else if (canSelectMoreDays) {
                                  field.onChange([...(field.value || []), day.value]);
                                }
                              }}
                              disabled={!canSelectMoreDays && !field.value?.includes(day.value)}
                            >
                              {day.label}
                            </Button>
                          )}
                        />
                      ))}
                    </div>
                    {errors.preferred_days && <p className="text-sm text-destructive mt-1">{errors.preferred_days.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Horário Preferido</Label>
                    <Controller name="preferred_time" control={control} render={({ field, fieldState }) => (
                      <>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <SelectTrigger><SelectValue placeholder="Hora Cheia" /></SelectTrigger>
                          <SelectContent>
                            {availableHours.map(hour => (
                              <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                      </>
                    )} />
                  </div>
                </div>

                {/* Registro de Pagamento (Apenas para novos alunos ou se o campo estiver vazio) */}
                {!selectedStudent && (
                  <div className="space-y-2 border-t pt-4 mt-4">
                    <div className="flex items-center space-x-2">
                      <Controller name="register_payment" control={control} render={({ field }) => (
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} id="register_payment" />
                      )} />
                      <Label htmlFor="register_payment">Registrar 1ª Mensalidade como PAGA agora</Label>
                    </div>
                    {registerPayment && (
                      <div className="space-y-2">
                        <Label>Data de Vencimento (Próximo Mês)</Label>
                        <Controller name="payment_due_date" control={control} render={({ field, fieldState }) => (
                          <>
                            <Input {...field} type="date" value={field.value || ''} />
                            {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                          </>
                        )} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="space-y-2 mt-4 border-t pt-4">
              <Label>Notas Adicionais</Label>
              <Controller name="notes" control={control} render={({ field }) => <Textarea {...field} value={field.value || ''} />} />
            </div>

          </div>

          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditStudentDialog;