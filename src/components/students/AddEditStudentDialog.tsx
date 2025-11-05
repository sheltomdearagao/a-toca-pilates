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

type PriceTable = {
  [planType: string]: {
    [frequency: string]: {
      [method: string]: number;
    }
  }
};

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
    if (data.register_payment && data.plan_type !== 'Avulso') {
      if (!data.payment_due_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A data de vencimento do pagamento é obrigatória.', path: ['payment_due_date'] });
      }
    }
  });
};

type StudentFormData = z.infer<ReturnType<typeof createStudentSchema>>;

interface AddEditStudentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedStudent: Student | null;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}

const AddEditStudentDialog = ({ isOpen, onOpenChange, selectedStudent, onSubmit, isSubmitting }: AddEditStudentDialogProps) => {
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const studentSchema = createStudentSchema(appSettings);

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: "", email: "", phone: "", address: "", guardian_phone: "", status: "Experimental", notes: "",
      plan_type: "Avulso", enrollment_type: "Particular", date_of_birth: null, validity_date: null,
      plan_frequency: null, payment_method: null,
      has_promotional_value: false, discount_description: null,
      register_payment: false,
      payment_due_date: null,
      monthly_fee: undefined,
    },
  });

  const planType = watch("plan_type");
  const planFrequency = watch("plan_frequency");
  const paymentMethod = watch("payment_method");
  const hasPromotionalValue = watch("has_promotional_value");
  const registerPayment = watch("register_payment");

  // Efeito para preenchimento automático da mensalidade com price_table
  useEffect(() => {
    // Se for Avulso, zera mensalidade
    if (planType === 'Avulso') {
      setValue('monthly_fee', 0);
      return;
    }

    // Se houver valor promocional, não fazer auto-fill
    if (hasPromotionalValue) {
      return;
    }

    if (planType && planFrequency && paymentMethod && appSettings?.price_table) {
      const priceTable = appSettings.price_table as PriceTable;
      const planPrices = priceTable[planType];
      if (planPrices) {
        const freqPrices = planPrices[planFrequency];
        if (freqPrices) {
          const price = freqPrices[paymentMethod];
          if (typeof price === 'number') {
            setValue('monthly_fee', price, { shouldValidate: true });
            return;
          }
        }
      }
    }

    // Se não encontrar preço, não sobrescreve o valor atual
  }, [planType, planFrequency, paymentMethod, hasPromotionalValue, appSettings, setValue]);

  // Sincronização com dados existentes (edição)
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
          plan_frequency: null, payment_method: null,
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

            {/* Campos simples omitidos para brevidade; manter a estrutura existente... */}

            {/* Campos de plano e pagamento (dinâmicos via appSettings) */}
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Controller name="plan_frequency" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger><SelectValue placeholder="Frequência" /></SelectTrigger>
                    <SelectContent>
                      {appSettings?.plan_frequencies.map(freq => (
                        <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Controller name="payment_method" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger><SelectValue placeholder="Meio de pagamento" /></SelectTrigger>
                    <SelectContent>
                      {appSettings?.price_table
                        ? (Object.keys(appSettings.price_table) // plano
                            .flatMap(plan => Object.values(appSettings.price_table![plan]).flatMap(freq => Object.keys(freq)) )
                            .filter((v, i, self) => self.indexOf(v) === i)
                          )
                        : null}
                      {appSettings?.payment_methods.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-2">
                <Label>Mensalidade (R$)</Label>
                <Controller name="monthly_fee" control={control} render={({ field }) => (
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                )} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas (Opcional)</Label>
              <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" {...field} />} />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={false}>
              <Loader2 className="mr-2 h-4 w-4" /> Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditStudentDialog;