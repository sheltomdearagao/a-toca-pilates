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
    '2x': { 'Cartão': 245, 'Espécie': 230 },
    '3x': { 'Cartão': 275, 'Espécie': 260 },
    '4x': { 'Cartão': 300, 'Espécie': 285 },
    '5x': { 'Cartão': 320, 'Espécie': 305 },
  },
  Trimestral: {
    '2x': { 'Cartão': 225, 'Espécie': 210 },
    '3x': { 'Cartão': 255, 'Espécie': 240 },
    '4x': { 'Cartão': 285, 'Espécie': 270 },
    '5x': { 'Cartão': 300, 'Espécie': 285 },
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
  const hour = i + 7; // 7h às 20h
  return `${hour.toString().padStart(2, '0')}:00`;
});

interface AddEditStudentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedStudent: Student | null;
  onSubmit: (data: StudentFormData) => void;
  isSubmitting: boolean;
}

type StudentFormData = z.infer<ReturnType<typeof createStudentSchema>>;

const createStudentSchema = (appSettings: any) => {
  const dynamicPlanTypeSchema = z.enum(appSettings?.plan_types as [string, ...string[]] || ["Avulso"]);
  const dynamicPlanFrequencySchema = z.enum(appSettings?.plan_frequencies as [string, ...string[]] || ["2x"]).optional();
  const dynamicPaymentMethodSchema = z.enum(appSettings?.payment_methods as [string, ...string[]] || ["Cartão"]).optional();
  const dynamicEnrollmentTypeSchema = z.enum(appSettings?.enrollment_types as [string, ...string[]] || ["Particular"]);

  return z.object({
    name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
    email: z.string().email("Email inválido.").optional().or(z.literal("")),
    phone: z.string().optional(),
    status: z.enum(["Ativo", "Inativo", "Experimental", "Bloqueado"]),
    notes: z.string().optional(),
    plan_type: dynamicPlanTypeSchema.default("Avulso"),
    plan_frequency: dynamicPlanFrequencySchema,
    payment_method: dynamicPaymentMethodSchema,
    monthly_fee: z.number().optional(),
    enrollment_type: dynamicEnrollmentTypeSchema.default("Particular"),
    date_of_birth: z.string().optional().nullable(),
    validity_date: z.string().optional().nullable(),
    preferred_days: z.array(z.string()).optional(),
    preferred_time: z.string().optional().nullable(),
  }).superRefine((data, ctx) => {
    if (data.plan_type !== 'Avulso') {
      if (!data.plan_frequency) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A frequência é obrigatória.', path: ['plan_frequency'] });
      }
      if (!data.payment_method) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'O método de pagamento é obrigatório.', path: ['payment_method'] });
      }
      if (!data.monthly_fee || data.monthly_fee <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'O valor da mensalidade deve ser maior que zero.', path: ['monthly_fee'] });
      }
    }
    if (data.preferred_days && data.preferred_days.length > 0 && !data.preferred_time) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'O horário é obrigatório se os dias forem selecionados.', path: ['preferred_time'] });
    }
    if (data.plan_frequency && data.preferred_days) {
      const expectedCount = parseInt(data.plan_frequency.replace('x', ''), 10);
      if (data.preferred_days.length > 0 && data.preferred_days.length !== expectedCount) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Selecione exatamente ${expectedCount} dias.`, path: ['preferred_days'] });
      }
    }
  });
};

const AddEditStudentDialog = ({ isOpen, onOpenChange, selectedStudent, onSubmit, isSubmitting }: AddEditStudentDialogProps) => {
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const studentSchema = createStudentSchema(appSettings);
  type StudentFormData = z.infer<typeof studentSchema>;

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: "", email: "", phone: "", status: "Experimental", notes: "",
      plan_type: "Avulso", enrollment_type: "Particular", date_of_birth: "", validity_date: "",
      preferred_days: [], preferred_time: null,
    },
  });

  const planType = watch("plan_type");
  const planFrequency = watch("plan_frequency");
  const paymentMethod = watch("payment_method");
  const preferredDays = watch("preferred_days") || [];

  const frequencyCount = planFrequency ? parseInt(planFrequency.replace('x', ''), 10) : 0;
  const canSelectMoreDays = preferredDays.length < frequencyCount;

  useEffect(() => {
    if (planType && planType !== 'Avulso' && planFrequency && paymentMethod) {
      const fee = pricingTable[planType as keyof typeof pricingTable]?.[planFrequency as keyof typeof pricingTable['Mensal']]?.[paymentMethod as keyof typeof pricingTable['Mensal']['2x']] || 0;
      setValue('monthly_fee', fee);
    } else {
      setValue('monthly_fee', 0);
    }
  }, [planType, planFrequency, paymentMethod, setValue]);

  useEffect(() => {
    if (isOpen) {
      if (selectedStudent) {
        reset({
          ...selectedStudent,
          email: selectedStudent.email || '',
          phone: selectedStudent.phone || '',
          notes: selectedStudent.notes || '',
          date_of_birth: selectedStudent.date_of_birth ? format(new Date(selectedStudent.date_of_birth), 'yyyy-MM-dd') : "",
          validity_date: selectedStudent.validity_date ? format(new Date(selectedStudent.validity_date), 'yyyy-MM-dd') : "",
          preferred_days: selectedStudent.preferred_days || [],
          preferred_time: selectedStudent.preferred_time || null,
        });
      } else {
        reset({
          name: "", email: "", phone: "", status: "Experimental", notes: "",
          plan_type: "Avulso", enrollment_type: "Particular", date_of_birth: "", validity_date: "",
          preferred_days: [], preferred_time: null,
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
            {/* Campos existentes... */}
            <div className="space-y-2"><Label>Nome</Label><Controller name="name" control={control} render={({ field, fieldState }) => (<><Input {...field} />{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Email</Label><Controller name="email" control={control} render={({ field, fieldState }) => (<><Input {...field} />{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div><div className="space-y-2"><Label>Telefone</Label><Controller name="phone" control={control} render={({ field, fieldState }) => (<><Input {...field} />{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div></div>
            <div className="space-y-2"><Label>Status</Label><Controller name="status" control={control} render={({ field, fieldState }) => (<><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem><SelectItem value="Experimental">Experimental</SelectItem><SelectItem value="Bloqueado">Bloqueado</SelectItem></SelectContent></Select>{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div>
            <div className="space-y-2"><Label>Plano</Label><Controller name="plan_type" control={control} render={({ field, fieldState }) => (<><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{appSettings?.plan_types.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select>{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div>
            {planType !== 'Avulso' && (<div className="grid grid-cols-2 gap-4 p-4 border bg-secondary/20 rounded-lg"><div className="space-y-2"><Label>Frequência</Label><Controller name="plan_frequency" control={control} render={({ field, fieldState }) => (<><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{appSettings?.plan_frequencies.map(freq => (<SelectItem key={freq} value={freq}>{freq} na semana</SelectItem>))}</SelectContent></Select>{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div><div className="space-y-2"><Label>Pagamento</Label><Controller name="payment_method" control={control} render={({ field, fieldState }) => (<><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{appSettings?.payment_methods.map(method => (<SelectItem key={method} value={method}>{method}</SelectItem>))}</SelectContent></Select>{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div><div className="col-span-2 text-center pt-2"><p className="text-sm text-muted-foreground">Valor da Mensalidade:</p><p className="text-xl font-bold text-primary">R$ {watch('monthly_fee')?.toFixed(2) || '0.00'}</p>{errors.monthly_fee && <p className="text-sm text-destructive mt-1">{errors.monthly_fee.message}</p>}</div></div>)}
            
            {/* Seção de Agendamento Automático */}
            {planType !== 'Avulso' && planFrequency && (
              <div className="space-y-4 p-4 border-t mt-4">
                <h4 className="font-semibold text-md">Agendamento Automático (Opcional)</h4>
                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <Controller
                    name="preferred_days"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map(day => (
                          <div key={day.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={day.value}
                              checked={field.value?.includes(day.value)}
                              disabled={!canSelectMoreDays && !field.value?.includes(day.value)}
                              onCheckedChange={(checked) => {
                                const newSelectedDays = checked
                                  ? [...(field.value || []), day.value]
                                  : (field.value || []).filter((value) => value !== day.value);
                                field.onChange(newSelectedDays);
                              }}
                            />
                            <Label htmlFor={day.value} className={cn(!canSelectMoreDays && !field.value?.includes(day.value) && "text-muted-foreground")}>{day.label}</Label>
                          </div>
                        ))}
                      </div>
                    )}
                  />
                  {errors.preferred_days && <p className="text-sm text-destructive mt-1">{errors.preferred_days.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Horário Preferido</Label>
                  <Controller
                    name="preferred_time"
                    control={control}
                    render={({ field, fieldState }) => (
                      <>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <SelectTrigger><SelectValue placeholder="Selecione um horário..." /></SelectTrigger>
                          <SelectContent>
                            {availableHours.map(hour => (<SelectItem key={hour} value={hour}>{hour}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                      </>
                    )}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2"><Label>Tipo de Matrícula</Label><Controller name="enrollment_type" control={control} render={({ field, fieldState }) => (<><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{appSettings?.enrollment_types.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select>{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="date_of_birth">Data de Nascimento</Label><Controller name="date_of_birth" control={control} render={({ field, fieldState }) => (<><Input id="date_of_birth" type="date" {...field} value={field.value || ''} />{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div><div className="space-y-2"><Label htmlFor="validity_date">Data de Validade</Label><Controller name="validity_date" control={control} render={({ field, fieldState }) => (<><Input id="validity_date" type="date" {...field} value={field.value || ''} />{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div></div>
            <div className="space-y-2"><Label>Notas</Label><Controller name="notes" control={control} render={({ field, fieldState }) => (<><Textarea {...field} />{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div>
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