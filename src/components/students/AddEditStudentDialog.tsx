import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
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
import { Loader2 } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { cn } from '@/lib/utils';
import { Student } from '@/types/student';

type PriceTable = {
  [planType: string]: {
    [frequency: string]: {
      [method: string]: number;
    };
  };
};

const createStudentSchema = (appSettings: any) => {
  const planTypes = appSettings?.plan_types as [string, ...string[]] || ['Avulso'];
  const frequencies = appSettings?.plan_frequencies as [string, ...string[]] || ['2x'];
  const methods = appSettings?.payment_methods as [string, ...string[]] || ['Espécie'];
  const enrollTypes = appSettings?.enrollment_types as [string, ...string[]] || ['Particular'];

  return z.object({
    name: z.string().min(3, 'Nome obrigatório'),
    email: z.string().email('Email inválido').optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    guardian_phone: z.string().optional().nullable(),
    status: z.enum(['Ativo', 'Inativo', 'Experimental', 'Bloqueado']),
    notes: z.string().optional().nullable(),
    plan_type: z.enum(planTypes),
    plan_frequency: z.enum(frequencies).optional().nullable(),
    payment_method: z.enum(methods).optional().nullable(),
    monthly_fee: z.preprocess(
      (val) => (typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val),
      z.number().min(0, 'Valor deve ser ≥ 0')
    ).optional(),
    enrollment_type: z.enum(enrollTypes),
    date_of_birth: z.string().optional().nullable(),
    validity_date: z.string().optional().nullable(),
    preferred_days: z.array(z.string()).optional().nullable(),
    preferred_time: z.string().optional().nullable(),
    has_promotional_value: z.boolean().optional(),
    discount_description: z.string().optional().nullable(),
    register_payment: z.boolean().optional(),
    payment_due_date: z.string().optional().nullable(),
  }).superRefine((data, ctx) => {
    if (data.plan_type !== 'Avulso') {
      if (!data.plan_frequency) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Frequência obrigatória', path: ['plan_frequency'] });
      if (!data.payment_method) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Método de pagamento obrigatório', path: ['payment_method'] });
      if (data.monthly_fee === undefined || data.monthly_fee === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Mensalidade obrigatória', path: ['monthly_fee'] });
      }
    }
    if (data.has_promotional_value && (!data.discount_description || data.discount_description.trim() === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Descrição do desconto obrigatória', path: ['discount_description'] });
    }
    if (data.register_payment && data.plan_type !== 'Avulso' && !data.payment_due_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data de vencimento obrigatória', path: ['payment_due_date'] });
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
  const { data: appSettings, isLoading: loadingSettings } = useAppSettings();
  const schema = createStudentSchema(appSettings);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', email: '', phone: '', address: '', guardian_phone: '',
      status: 'Experimental', notes: '',
      plan_type: 'Avulso', plan_frequency: null, payment_method: null, monthly_fee: 0,
      enrollment_type: 'Particular',
      date_of_birth: null, validity_date: null, preferred_days: null, preferred_time: null,
      has_promotional_value: false, discount_description: null,
      register_payment: false, payment_due_date: null,
    },
  });

  const planType = watch('plan_type');
  const planFrequency = watch('plan_frequency');
  const paymentMethod = watch('payment_method');
  const hasPromo = watch('has_promotional_value');

  useEffect(() => {
    if (!appSettings?.price_table) return;
    if (planType === 'Avulso') {
      setValue('monthly_fee', 0);
      return;
    }
    if (hasPromo) return;
    const table: PriceTable = appSettings.price_table;
    const freqMap = table[planType]?.[planFrequency ?? ''] ?? {};
    const price = freqMap[paymentMethod ?? ''] ?? null;
    if (price !== null) setValue('monthly_fee', price);
  }, [planType, planFrequency, paymentMethod, hasPromo, appSettings, setValue]);

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
        plan_frequency: selectedStudent.plan_frequency || null,
        payment_method: selectedStudent.payment_method || null,
        monthly_fee: selectedStudent.monthly_fee ?? 0,
        enrollment_type: selectedStudent.enrollment_type,
        date_of_birth: selectedStudent.date_of_birth ? format(parseISO(selectedStudent.date_of_birth), 'yyyy-MM-dd') : null,
        validity_date: selectedStudent.validity_date ? format(parseISO(selectedStudent.validity_date), 'yyyy-MM-dd') : null,
        preferred_days: selectedStudent.preferred_days || null,
        preferred_time: selectedStudent.preferred_time || null,
        has_promotional_value: !!selectedStudent.discount_description,
        discount_description: selectedStudent.discount_description || null,
        register_payment: false,
        payment_due_date: null,
      });
    } else {
      reset({});
    }
  }, [isOpen, selectedStudent, reset]);

  if (loadingSettings) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selectedStudent ? 'Editar Aluno' : 'Novo Aluno'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Controller name="name" control={control} render={({ field }) => <Input {...field} />} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Controller name="email" control={control} render={({ field }) => <Input {...field} />} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
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
            <div className="space-y-2">
              <Label>Telefone Responsável</Label>
              <Controller name="guardian_phone" control={control} render={({ field }) => <Input {...field} />} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Controller name="status" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Ativo','Inativo','Experimental','Bloqueado'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Controller name="notes" control={control} render={({ field }) => <Textarea {...field} />} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Controller name="plan_type" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {appSettings.plan_types.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Controller name="plan_frequency" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {appSettings.plan_frequencies.map(fp => <SelectItem key={fp} value={fp}>{fp}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-2">
                <Label>Forma Pagto</Label>
                <Controller name="payment_method" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {appSettings.payment_methods.map(pm => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mensalidade (R$)</Label>
              <Controller name="monthly_fee" control={control} render={({ field }) => <Input type="number" step="0.01" {...field} />} />
              {errors.monthly_fee && <p className="text-sm text-destructive">{errors.monthly_fee.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data Nasc.</Label>
                <Controller name="date_of_birth" control={control} render={({ field }) => <Input type="date" {...field} />} />
              </div>
              <div className="space-y-2">
                <Label>Validade</Label>
                <Controller name="validity_date" control={control} render={({ field }) => <Input type="date" {...field} />} />
              </div>
              <div className="space-y-2">
                <Label>Tipo Matrícula</Label>
                <Controller name="enrollment_type" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {appSettings.enrollment_types.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dias Preferidos</Label>
              <Controller name="preferred_days" control={control} render={({ field }) => (
                <Input placeholder="e.g. monday,tuesday" {...field} />
              )} />
            </div>
            <div className="space-y-2">
              <Label>Horário Preferido</Label>
              <Controller name="preferred_time" control={control} render={({ field }) => <Input type="time" {...field} />} />
            </div>
            <div className="flex items-center space-x-2">
              <Controller name="has_promotional_value" control={control} render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              )} />
              <Label>Valor Promocional</Label>
            </div>
            {watch('has_promotional_value') && (
              <div className="space-y-2">
                <Label>Descrição do Desconto</Label>
                <Controller name="discount_description" control={control} render={({ field }) => <Input {...field} />} />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Controller name="register_payment" control={control} render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              )} />
              <Label>Registrar 1º Pagamento</Label>
            </div>
            {watch('register_payment') && (
              <div className="space-y-2">
                <Label>Data Vencimento 1º</Label>
                <Controller name="payment_due_date" control={control} render={({ field }) => <Input type="date" {...field} />} />
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditStudentDialog;