import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { RecurringExpenseTemplate } from '@/types/financial';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, MoreHorizontal, Edit, Trash2, Repeat, PlusCircle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR'; // Corrigido o caminho de importação
import { useAppSettings } from '@/hooks/useAppSettings'; // Importar o hook

const recurrenceIntervals = [
  { label: 'Mensal', value: 'monthly' },
  { label: 'Trimestral', value: 'quarterly' },
  { label: 'Anual', value: 'yearly' },
];

const templateSchema = z.object({
  description: z.string().min(3, 'A descrição é obrigatória.'),
  category: z.string().min(1, 'A categoria é obrigatória.'),
  amount: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive("O valor deve ser positivo.")
  ),
  recurrence_interval: z.enum(['monthly', 'quarterly', 'yearly']),
  start_date: z.string().min(1, 'A data de início é obrigatória.'),
  end_date: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.end_date && new Date(data.end_date) < new Date(data.start_date)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A data de término deve ser posterior à data de início.',
      path: ['end_date'],
    });
  }
});

type TemplateFormData = z.infer<typeof templateSchema>;

const fetchRecurringExpenseTemplates = async (): Promise<RecurringExpenseTemplate[]> => {
  const { data, error } = await supabase.from('recurring_expense_templates').select('*').order('description');
  if (error) throw new Error(error.message);
  return data || [];
};

const RecurringExpenseTemplatesTab = () => {
  const queryClient = useQueryClient();
  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RecurringExpenseTemplate | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      description: '',
      category: '',
      amount: 0,
      recurrence_interval: 'monthly',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
    },
  });

  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const expenseCategories = appSettings?.expense_categories || ["Aluguel", "Salários", "Marketing", "Material", "Contas", "Outras Despesas"];

  const { data: templates, isLoading } = useQuery({
    queryKey: ['recurringExpenseTemplates'],
    queryFn: fetchRecurringExpenseTemplates,
  });

  const mutation = useMutation({
    mutationFn: async (formData: TemplateFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const dataToSubmit = {
        user_id: user.id,
        description: formData.description,
        category: formData.category,
        amount: formData.amount,
        recurrence_interval: formData.recurrence_interval,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
      };

      if (selectedTemplate) {
        const { error } = await supabase.from('recurring_expense_templates').update(dataToSubmit).eq('id', selectedTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('recurring_expense_templates').insert([dataToSubmit]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringExpenseTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] }); // Invalidate actual transactions
      showSuccess(`Modelo de despesa recorrente ${selectedTemplate ? 'atualizado' : 'adicionado'} com sucesso!`);
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
      const { error } = await supabase.from('recurring_expense_templates').delete().eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringExpenseTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] }); // Invalidate actual transactions
      showSuccess('Modelo de despesa recorrente excluído com sucesso!');
      setDeleteAlertOpen(false);
      setSelectedTemplate(null);
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleAddNew = () => {
    setSelectedTemplate(null);
    reset({
      description: '',
      category: '',
      amount: 0,
      recurrence_interval: 'monthly',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
    });
    setFormOpen(true);
  };

  const handleEdit = (template: RecurringExpenseTemplate) => {
    setSelectedTemplate(template);
    reset({
      description: template.description,
      category: template.category,
      amount: template.amount,
      recurrence_interval: template.recurrence_interval,
      start_date: template.start_date,
      end_date: template.end_date || '',
    });
    setFormOpen(true);
  };

  const handleDelete = (template: RecurringExpenseTemplate) => {
    setSelectedTemplate(template);
    setDeleteAlertOpen(true);
  };

  const onSubmit = (data: TemplateFormData) => {
    mutation.mutate(data);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Modelos de Despesas Recorrentes</h2>
        <Button onClick={handleAddNew}>
          <PlusCircle className="w-4 h-4 mr-2" /> Adicionar Modelo
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="bg-card rounded-lg border shadow-impressionist"> {/* Aplicando a nova sombra */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Recorrência</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id} className="hover:bg-muted/50 transition-colors"> {/* Efeito de hover sutil */}
                  <TableCell className="font-medium">{template.description}</TableCell>
                  <TableCell>{template.category}</TableCell>
                  <TableCell>{formatCurrency(template.amount)}</TableCell>
                  <TableCell>{recurrenceIntervals.find(i => i.value === template.recurrence_interval)?.label}</TableCell>
                  <TableCell>
                    {format(parseISO(template.start_date), 'dd/MM/yyyy')}
                    {template.end_date ? ` - ${format(parseISO(template.end_date), 'dd/MM/yyyy')}` : ' (Sem fim)'}
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
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg shadow-impressionist border-primary/50"> {/* Aplicando a nova sombra e borda colorida */}
          <Repeat className="w-12 h-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Nenhum modelo de despesa recorrente encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">Adicione seu primeiro modelo de despesa recorrente.</p>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTemplate ? "Editar Modelo de Despesa Recorrente" : "Adicionar Novo Modelo de Despesa Recorrente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Controller name="description" control={control} render={({ field }) => <Input id="description" {...field} />} />
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor</Label>
                  <Controller name="amount" control={control} render={({ field }) => <Input id="amount" type="number" step="0.01" {...field} />} />
                  {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Controller name="category" control={control} render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {isLoadingSettings ? (
                            <SelectItem value="loading" disabled>Carregando...</SelectItem>
                          ) : (expenseCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>)))}
                        </SelectContent>
                      </Select>
                  )} />
                  {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrence_interval">Intervalo de Recorrência</Label>
                <Controller name="recurrence_interval" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{recurrenceIntervals.map(interval => (<SelectItem key={interval.value} value={interval.value}>{interval.label}</SelectItem>))}</SelectContent>
                    </Select>
                )} />
                {errors.recurrence_interval && <p className="text-sm text-destructive mt-1">{errors.recurrence_interval.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data de Início</Label>
                  <Controller name="start_date" control={control} render={({ field }) => <Input id="start_date" type="date" {...field} />} />
                  {errors.start_date && <p className="text-sm text-destructive mt-1">{errors.start_date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Data de Fim (Opcional)</Label>
                  <Controller name="end_date" control={control} render={({ field }) => <Input id="end_date" type="date" {...field} />} />
                  {errors.end_date && <p className="text-sm text-destructive mt-1">{errors.end_date.message}</p>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Modelo
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
              Essa ação não pode ser desfeita. Isso irá remover permanentemente o modelo de despesa recorrente "{selectedTemplate?.description}" do banco de dados. Novas despesas não serão mais criadas a partir deste modelo.
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

export default RecurringExpenseTemplatesTab;