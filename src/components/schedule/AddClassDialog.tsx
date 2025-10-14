import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, set } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { StudentOption } from '@/types/student';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const classSchema = z.object({
  student_id: z.string().optional().nullable(),
  title: z.string().min(3, 'O título é obrigatório.').optional(),
  date: z.string().min(1, 'A data é obrigatória.'),
  time: z.string().min(1, 'O horário é obrigatório.'),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.student_id && (!data.title || data.title.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O título da aula é obrigatório se nenhum aluno for selecionado.',
      path: ['title'],
    });
  }
});

type ClassFormData = z.infer<typeof classSchema>;

interface AddClassDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  quickAddSlot?: { date: Date; hour: number } | null;
  onQuickAdd?: (date: Date, hour: number) => void;
}

// Horários disponíveis (6h às 21h)
const availableHours = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 6;
  return {
    value: `${hour.toString().padStart(2, '0')}:00`,
    label: `${hour.toString().padStart(2, '0')}:00`,
  };
});

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, enrollment_type')
    .order('name');
  
  if (error) throw new Error(error.message);
  return data || [];
};

const AddClassDialog = ({ isOpen, onOpenChange, quickAddSlot, onQuickAdd }: AddClassDialogProps) => {
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_id: null,
      title: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '08:00',
      notes: '',
    },
  });

  const selectedStudentId = watch('student_id');

  const { data: students, isLoading: isLoadingStudents } = useQuery<StudentOption[]>({
    queryKey: ['allStudents'],
    queryFn: fetchAllStudents,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isOpen) {
      if (quickAddSlot) {
        reset({
          student_id: null,
          title: '',
          date: format(quickAddSlot.date, 'yyyy-MM-dd'),
          time: `${quickAddSlot.hour.toString().padStart(2, '0')}:00`,
          notes: '',
        });
      } else {
        reset({
          student_id: null,
          title: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          time: '08:00',
          notes: '',
        });
      }
    }
  }, [isOpen, quickAddSlot, reset]);

  const mutation = useMutation({
    mutationFn: async (formData: ClassFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const classTitle = formData.student_id
        ? students?.find(s => s.id === formData.student_id)?.name || 'Aula com Aluno'
        : formData.title;

      // Criar datetime combinando data e hora
      const [hours, minutes] = formData.time.split(':');
      const dateTime = set(new Date(formData.date), {
        hours: parseInt(hours),
        minutes: parseInt(minutes),
        seconds: 0,
        milliseconds: 0,
      });
      
      const startUtc = fromZonedTime(dateTime, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
      
      const dataToSubmit = {
        user_id: user.id,
        title: classTitle,
        start_time: startUtc,
        duration_minutes: 60,
        notes: formData.notes,
        student_id: formData.student_id || null,
      };
      const { error } = await supabase.from('classes').insert([dataToSubmit]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Aula agendada com sucesso!');
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const onSubmit = (data: ClassFormData) => {
    mutation.mutate(data);
  };

  const handleQuickAdd = () => {
    if (quickAddSlot && onQuickAdd) {
      onQuickAdd(quickAddSlot.date, quickAddSlot.hour);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Nova Aula</DialogTitle>
        </DialogHeader>
        {quickAddSlot ? (
          <div className="py-4">
            <p className="text-center text-muted-foreground mb-4">
              Agendamento rápido para {format(quickAddSlot.date, 'dd/MM/yyyy')} às {quickAddSlot.hour}:00
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleQuickAdd} disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Agendamento
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="student_id">Aluno (Opcional)</Label>
                <Controller
                  name="student_id"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isLoadingStudents}
                        >
                          {field.value
                            ? students?.find((student) => student.id === field.value)?.name
                            : "Selecione um aluno..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar aluno..." />
                          <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                          <CommandGroup>
                            {students?.map((student) => (
                              <CommandItem
                                value={student.name}
                                key={student.id}
                                onSelect={() => {
                                  field.onChange(student.id);
                                  setValue('title', `Aula com ${student.name}`);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    student.id === field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {student.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.student_id && <p className="text-sm text-destructive mt-1">{errors.student_id.message}</p>}
              </div>

              {!selectedStudentId && (
                <div className="space-y-2">
                  <Label htmlFor="title">Título da Aula</Label>
                  <Controller name="title" control={control} render={({ field }) => <Input id="title" {...field} />} />
                  {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Controller name="date" control={control} render={({ field }) => <Input id="date" type="date" {...field} />} />
                {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Horário</Label>
                <Controller
                  name="time"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o horário..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableHours.map(hour => (
                          <SelectItem key={hour.value} value={hour.value}>
                            {hour.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.time && <p className="text-sm text-destructive mt-1">{errors.time.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas (Opcional)</Label>
                <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" {...field} />} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Agendar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddClassDialog;