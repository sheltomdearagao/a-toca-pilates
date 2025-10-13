import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { format, parseISO, addMinutes } from 'date-fns'; // Importar addMinutes
import { ClassEvent } from '@/types/schedule';
import { StudentOption } from '@/types/student';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { fromZonedTime } from 'date-fns-tz';

const classSchema = z.object({
  student_id: z.string().optional().nullable(),
  title: z.string().min(3, 'O título é obrigatório.').optional(),
  start_time: z.string().min(1, 'A data e hora de início são obrigatórias.'),
  duration_minutes: z.number().min(1, 'A duração deve ser de pelo menos 1 minuto.').default(60), // Nova coluna
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.student_id && (!data.title || data.title.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O título da aula é obrigatório se nenhum aluno for selecionado.',
      path: ['title'],
    });
  }
  if (!data.duration_minutes || data.duration_minutes <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A duração da aula deve ser maior que zero.',
      path: ['duration_minutes'],
    });
  }
});

export type ClassFormData = z.infer<typeof classSchema>;

interface ClassEditFormProps {
  classEvent: Partial<ClassEvent> | null;
  allStudents: StudentOption[] | undefined;
  isLoadingAllStudents: boolean;
  onSubmit: (data: ClassFormData) => void;
  onCancelEdit: () => void;
  isSubmitting: boolean;
}

const ClassEditForm = ({
  classEvent,
  allStudents,
  isLoadingAllStudents,
  onSubmit,
  onCancelEdit,
  isSubmitting,
}: ClassEditFormProps) => {
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_id: null,
      title: '',
      start_time: '',
      duration_minutes: 60,
      notes: '',
    },
  });

  const selectedStudentId = watch('student_id');

  useEffect(() => {
    if (classEvent) {
      reset({
        title: classEvent.title || '',
        start_time: classEvent.start_time ? format(parseISO(classEvent.start_time), "yyyy-MM-dd'T'HH:mm") : '',
        duration_minutes: classEvent.duration_minutes || 60, // Set default or existing duration
        notes: classEvent.notes || '',
        student_id: classEvent.student_id || null,
      });
    }
  }, [classEvent, reset]);

  return (
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
                    disabled={isLoadingAllStudents}
                  >
                    {field.value
                      ? allStudents?.find((student) => student.id === field.value)?.name
                      : "Selecione um aluno..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar aluno..." />
                    <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                    <CommandGroup>
                      {allStudents?.map((student) => (
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
            <Label htmlFor="title">Título da Aula (Obrigatório se nenhum aluno for selecionado)</Label>
            <Controller name="title" control={control} render={({ field }) => <Input id="title" {...field} />} />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_time">Início</Label>
            <Controller name="start_time" control={control} render={({ field }) => <Input id="start_time" type="datetime-local" {...field} />} />
            {errors.start_time && <p className="text-sm text-destructive mt-1">{errors.start_time.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration_minutes">Duração (minutos)</Label>
            <Controller name="duration_minutes" control={control} render={({ field }) => <Input id="duration_minutes" type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />} />
            {errors.duration_minutes && <p className="text-sm text-destructive mt-1">{errors.duration_minutes.message}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notas (Opcional)</Label>
          <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" {...field} />} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="secondary" onClick={onCancelEdit}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Alterações
        </Button>
      </div>
    </form>
  );
};

export default ClassEditForm;