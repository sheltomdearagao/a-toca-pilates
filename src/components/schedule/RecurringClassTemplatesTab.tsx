import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { RecurringClassTemplate } from '@/types/schedule';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, MoreHorizontal, Edit, Trash2, Repeat } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, parseISO, addMinutes } from 'date-fns'; // Importar addMinutes
import { ptBR } from 'date-fns/locale/pt-BR';

const templateSchema = z.object({
  title: z.string().min(3, 'O título é obrigatório.'),
  start_time_of_day: z.string().min(1, 'A hora de início é obrigatória.'),
  duration_minutes: z.number().min(1, 'A duração deve ser de pelo menos 1 minuto.').default(60), // Nova coluna
  notes: z.string().optional(),
  recurrence_days_of_week: z.array(z.string()).min(1, 'Selecione pelo menos um dia da semana.'),
  recurrence_start_date: z.string().min(1, 'A data de início da recorrência é obrigatória.'),
  recurrence_end_date: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.recurrence_end_date && new Date(data.recurrence_end_date) < new Date(data.recurrence_start_date)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A data de término da recorrência deve ser posterior à data de início.',
      path: ['recurrence_end_date'],
    });
  }
});

type TemplateFormData = z.infer<typeof templateSchema>;

const daysOfWeekOptions = [
  { label: 'Seg', value: 'monday' },
  { label: 'Ter', value: 'tuesday' },
  { label: 'Qua', value: 'wednesday' },
  { label: 'Qui', value: 'thursday' },
  { label: 'Sex', value: 'friday' },
  { label: 'Sáb', value: 'saturday' },
  { label: 'Dom', value: 'sunday' },
];

const fetchRecurringClassTemplates = async (): Promise<RecurringClassTemplate[]> => {
  const { data, error } = await supabase.from('recurring_class_templates').select('*').order('title');
  if (error) throw new Error(error.message);
  return data || [];
};

const RecurringClassTemplatesTab = () => {
  const queryClient = useQueryClient();
  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RecurringClassTemplate | null>(null);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      title: '',
      start_time_of_day: '08:00',
      duration_minutes: 60, // Default duration
      notes: '',
      recurrence_days_of_week: [],
      recurrence_start_date: format(new Date(), 'yyyy-MM-dd'),
      recurrence_end_date: null,
    },
  });

  const recurrenceDays = watch('recurrence_days_of_week');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['recurringClassTemplates'],
    queryFn: fetchRecurringClassTemplates,
  });

  const mutation = useMutation({
    mutationFn: async (formData: TemplateFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const dataToSubmit = {
        user_id: user.id,
        title: formData.title,
        start_time_of_day: formData.start_time_of_day,
        duration_minutes: formData.duration_minutes, // Store duration_minutes
        notes: formData.notes,
        recurrence_days_of_week: formData.recurrence_days_of_week,
        recurrence_start_date: formData.recurrence_start_date,
        recurrence_end_date: formData.recurrence_end_date || null,
      };

      if (selectedTemplate) {
        const { error } = await supabase.from('recurring_class_templates').update(dataToSubmit).eq('id', selectedTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('recurring_class_templates').insert([dataToSubmit]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringClassTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess(`Modelo de aula recorrente ${selectedTemplate ? 'atualizado' : 'adicionado'} com sucesso!`);
      setFormOpen(false);
      setSelectedTemplate(null);
      reset();
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('recurring_class_templates').delete().eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringClassTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Modelo de aula recorrente excluído com sucesso!');
      setDeleteAlertOpen(false);
      setSelectedTemplate(null);
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleEdit = (template: RecurringClassTemplate) => {
    setSelectedTemplate(template);
    reset({
      title: template.title,
      start_time_of_day: template.start_time_of_day.substring(0, 5),
      duration_minutes: template.duration_minutes,
      notes: template.notes || '',
      recurrence_days_of_week: template.recurrence_days_of_week,
      recurrence_start_date: template.recurrence_start_date,
      recurrence_end_date: template.recurrence_end_date || null,
    });
    setFormOpen(true);
  };

  const handleDelete = (template: RecurringClassTemplate) => {
    setSelectedTemplate(template);
    setDeleteAlertOpen(true);
  };

  const onSubmit = (data: TemplateFormData) => {
    mutation.mutate(data);
  };

  return (
    <div className="mt-4">
      <h2 className="text-2xl font-bold mb-4">Modelos de Aulas Recorrentes</h2>
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="bg-card rounded-lg border shadow-impressionist">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{template.title}</TableCell>
                  <TableCell>{template.start_time_of_day.substring(0, 5)}</TableCell>
                  <TableCell>{template.duration_minutes} min</TableCell>
                  <TableCell>
                    {template.recurrence_days_of_week.map(day => daysOfWeekOptions.find(d => d.value === day)?.label).join(', ')}
                  </TableCell>
                  <TableCell>
                    {format(parseISO(template.recurrence_start_date), 'dd/MM/yyyy')}
                    {template.recurrence_end_date ? ` - ${format(parseISO(template.recurrence_end_date), 'dd/MM/yyyy')}` : ' (Sem fim)'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(template)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg shadow-impressionist border-primary/50">
          <Repeat className="w-12 h-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Nenhum modelo de aula recorrente encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crie um novo modelo na aba "Agenda" marcando a opção "Aula Recorrente".</p>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTemplate ? "Editar Modelo de Aula Recorrente" : "Adicionar Novo Modelo de Aula Recorrente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título da Aula</Label>
                <Controller name="title" control={control} render={({ field }) => <Input id="title" {...field} />} />
                {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time_of_day">Hora de Início</Label>
                  <Controller name="start_time_of_day" control={control} render={({ field }) => <Input id="start_time_of_day" type="time" {...field} />} />
                  {errors.start_time_of_day && <p className="text-sm text-destructive mt-1">{errors.start_time_of_day.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration_minutes">Duração (minutos)</Label>
                  <Controller name="duration_minutes" control={control} render={({ field }) => <Input id="duration_minutes" type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />} />
                  {errors.duration_minutes && <p className="text-sm text-destructive mt-1">{errors.duration_minutes.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dias da Semana</Label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeekOptions.map(day => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={recurrenceDays?.includes(day.value)}
                        onCheckedChange={(checked) => {
                            const currentDays = recurrenceDays || [];
                            if (checked) {
                              setValue('recurrence_days_of_week', [...currentDays, day.value]);
                            } else {
                              setValue('recurrence_days_of_week', currentDays.filter(d => d !== day.value));
                            }
                        }}
                      />
                      <Label htmlFor={`day-${day.value}`}>{day.label}</Label>
                    </div>
                  ))}
                </div>
                {errors.recurrence_days_of_week && <p className="text-sm text-destructive mt-1">{errors.recurrence_days_of_week.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recurrence_start_date">Data de Início da Recorrência</Label>
                  <Controller name="recurrence_start_date" control={control} render={({ field }) => <Input id="recurrence_start_date" type="date" {...field} />} />
                  {errors.recurrence_start_date && <p className="text-sm text-destructive mt-1">{errors.recurrence_start_date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurrence_end_date">Data de Fim da Recorrência (Opcional)</Label>
                  <Controller name="recurrence_end_date" control={control} render={({ field }) => <Input id="recurrence_end_date" type="date" {...field} />} />
                  {errors.recurrence_end_date && <p className="text-sm text-destructive mt-1">{errors.recurrence_end_date.message}</p>}
                </div>
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
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso irá remover permanentemente o modelo de aula recorrente "{selectedTemplate?.title}" do banco de dados. As aulas já geradas não serão excluídas, mas novas aulas não serão mais criadas a partir deste modelo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)} disabled={deleteMutation.isPending} className="bg-destructive hover:bg-destructive/90">
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RecurringClassTemplatesTab;