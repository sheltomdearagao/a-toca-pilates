import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, MinusCircle } from 'lucide-react';
import { Instructor, WorkingDay, InstructorStatus } from '@/types/instructor';
import { showError } from '@/utils/toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns'; // Importar format e parseISO

const DAYS_OF_WEEK_FULL = [
  { value: 'monday', label: 'Segunda-feira' },
  { value: 'tuesday', label: 'Terça-feira' },
  { value: 'wednesday', label: 'Quarta-feira' },
  { value: 'thursday', label: 'Quinta-feira' },
  { value: 'friday', label: 'Sexta-feira' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

const AVAILABLE_HOURS = Array.from({ length: 16 }, (_, i) => {
  const h = 6 + i; // 6:00 to 21:00
  return `${h.toString().padStart(2, '0')}:00`;
});

const instructorSchema = z.object({
  name: z.string().min(3, 'Nome é obrigatório'),
  email: z.string().email('Email inválido').optional().nullable().transform(e => e?.trim() === '' ? null : e),
  phone: z.string().optional().nullable().transform(p => p?.trim() === '' ? null : p),
  address: z.string().optional().nullable().transform(a => a?.trim() === '' ? null : a),
  notes: z.string().optional().nullable().transform(n => n?.trim() === '' ? null : n),
  status: z.enum(['Ativo', 'Inativo', 'Férias']),
  hourly_rate: z.preprocess(
    (val) => typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val,
    z.number().min(0, 'Valor da hora deve ser positivo').optional().nullable()
  ),
  working_days: z.array(z.object({
    day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM inválido'),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM inválido'),
  })).optional().nullable(),
  date_of_birth: z.string().optional().nullable().transform(d => d?.trim() === '' ? null : d), // NOVO CAMPO
}).superRefine((data, ctx) => {
  if (data.working_days) {
    data.working_days.forEach((wd, index) => {
      if (wd.start_time && wd.end_time && wd.start_time >= wd.end_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Hora de início deve ser anterior à hora de término.',
          path: [`working_days.${index}.end_time`],
        });
      }
    });
  }
});

type InstructorFormData = z.infer<typeof instructorSchema>;

interface AddEditInstructorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedInstructor: Instructor | null;
  onSubmit: (data: InstructorFormData) => void;
  isSubmitting: boolean;
}

const AddEditInstructorDialog = ({
  isOpen,
  onOpenChange,
  selectedInstructor,
  onSubmit,
  isSubmitting,
}: AddEditInstructorDialogProps) => {
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<InstructorFormData>({
    resolver: zodResolver(instructorSchema),
    defaultValues: {
      name: '',
      email: null,
      phone: null,
      address: null,
      notes: null,
      status: 'Ativo',
      hourly_rate: null,
      working_days: [],
      date_of_birth: null, // Definir default
    },
  });

  const watchedWorkingDays = watch('working_days');

  useEffect(() => {
    if (isOpen) {
      if (selectedInstructor) {
        reset({
          name: selectedInstructor.name,
          email: selectedInstructor.email,
          phone: selectedInstructor.phone,
          address: selectedInstructor.address,
          notes: selectedInstructor.notes,
          status: selectedInstructor.status,
          hourly_rate: selectedInstructor.hourly_rate,
          working_days: selectedInstructor.working_days || [],
          date_of_birth: selectedInstructor.date_of_birth ? format(parseISO(selectedInstructor.date_of_birth), 'yyyy-MM-dd') : null, // Formatar para input type="date"
        });
      } else {
        reset({
          name: '',
          email: null,
          phone: null,
          address: null,
          notes: null,
          status: 'Ativo',
          hourly_rate: null,
          working_days: [],
          date_of_birth: null,
        });
      }
    }
  }, [isOpen, selectedInstructor, reset]);

  const handleAddWorkingDay = () => {
    setValue('working_days', [...(watchedWorkingDays || []), { day: 'monday', start_time: '08:00', end_time: '17:00' }]);
  };

  const handleRemoveWorkingDay = (index: number) => {
    const newWorkingDays = (watchedWorkingDays || []).filter((_, i) => i !== index);
    setValue('working_days', newWorkingDays);
  };

  const handleWorkingDayChange = (index: number, field: keyof WorkingDay, value: string) => {
    const newWorkingDays = [...(watchedWorkingDays || [])];
    if (newWorkingDays[index]) {
      (newWorkingDays[index] as any)[field] = value;
      setValue('working_days', newWorkingDays);
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selectedInstructor ? 'Editar Instrutor' : 'Novo Instrutor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit, handleFormError)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} />} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email (Opcional)</Label>
                <Controller name="email" control={control} render={({ field }) => <Input id="email" type="email" {...field} />} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (Opcional)</Label>
                <Controller name="phone" control={control} render={({ field }) => <Input id="phone" {...field} />} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço (Opcional)</Label>
              <Controller name="address" control={control} render={({ field }) => <Input id="address" {...field} />} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas (Opcional)</Label>
              <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" {...field} />} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                      <SelectItem value="Férias">Férias</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
                {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Valor Hora (R$ - Opcional)</Label>
                <Controller name="hourly_rate" control={control} render={({ field }) => (
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || null)}
                  />
                )} />
                {errors.hourly_rate && <p className="text-sm text-destructive">{errors.hourly_rate.message}</p>}
              </div>
            </div>

            {/* NOVO CAMPO: Data de Nascimento */}
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Data de Nascimento (Opcional)</Label>
              <Controller name="date_of_birth" control={control} render={({ field }) => (
                <Input id="date_of_birth" type="date" {...field} value={field.value || ''} />
              )} />
              {errors.date_of_birth && <p className="text-sm text-destructive">{errors.date_of_birth.message}</p>}
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>Dias e Horários de Trabalho (Opcional)</Label>
              {(watchedWorkingDays || []).map((wd, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Controller
                    name={`working_days.${index}.day`}
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={(value) => handleWorkingDayChange(index, 'day', value)} value={field.value}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK_FULL.map(day => (
                            <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Controller
                    name={`working_days.${index}.start_time`}
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={(value) => handleWorkingDayChange(index, 'start_time', value)} value={field.value}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Início" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_HOURS.map(hour => (
                            <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Controller
                    name={`working_days.${index}.end_time`}
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={(value) => handleWorkingDayChange(index, 'end_time', value)} value={field.value}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Fim" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_HOURS.map(hour => (
                            <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveWorkingDay(index)}>
                    <MinusCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {errors.working_days && <p className="text-sm text-destructive mt-1">{errors.working_days.message}</p>}
              <Button type="button" variant="outline" size="sm" onClick={handleAddWorkingDay} className="mt-2">
                <PlusCircle className="h-4 w-4 mr-2" /> Adicionar Dia
              </Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedInstructor ? 'Atualizar' : 'Criar'} Instrutor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditInstructorDialog;