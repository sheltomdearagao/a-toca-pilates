import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { format, parseISO, set } from 'date-fns';
import { ClassEvent } from '@/types/schedule';
import { StudentOption } from '@/types/student';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { fromZonedTime } from 'date-fns-tz';

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

export type ClassFormData = z.infer<typeof classSchema>;

// Horários disponíveis (6h às 21h)
const availableHours = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 6;
  return {
    value: `${hour.toString().padStart(2, '0')}:00`,
    label: `${hour.toString().padStart(2, '0')}:00`,
  };
});

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
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '08:00',
      notes: '',
    },
  });

  const selectedStudentId = watch('student_id');

  useEffect(() => {
    if (classEvent && classEvent.start_time) {
      const startTime = parseISO(classEvent.start_time);
      reset({
        title: classEvent.title || '',
        date: format(startTime, 'yyyy-MM-dd'),
        time: format(startTime, 'HH:mm'),
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