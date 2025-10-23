import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RecurringClassTemplate } from '@/types/schedule';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, CalendarDays, Edit } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { showError, showSuccess } from '@/utils/toast';
import DeleteRecurringTemplateAlertDialog from './DeleteRecurringTemplateAlertDialog';
import FinancialTableSkeleton from '@/components/financial/FinancialTableSkeleton'; // Reutilizando o skeleton de tabela
import EditRecurringClassTemplateDialog from './EditRecurringClassTemplateDialog'; // Importar o novo componente

const DAYS_OF_WEEK_MAP: { [key: string]: string } = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

const fetchRecurringClassTemplates = async (): Promise<RecurringClassTemplate[]> => {
  const { data, error } = await supabase
    .from('recurring_class_templates')
    .select(`
      id,
      user_id,
      student_id,
      title,
      duration_minutes,
      notes,
      recurrence_pattern,
      recurrence_start_date,
      recurrence_end_date,
      created_at,
      students(name)
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);

  // Normaliza a propriedade 'students' para corresponder ao tipo RecurringClassTemplate
  const normalizedData: RecurringClassTemplate[] = (data || []).map(item => {
    const studentName = (item.students as { name: string }[] | null)?.[0]?.name;
    return {
      ...item,
      students: studentName ? { name: studentName } : undefined,
    } as RecurringClassTemplate; // Cast final para garantir o tipo
  });

  return normalizedData;
};

interface RecurringTemplatesListProps {
  // onEditTemplate removido, pois a lógica de edição será interna
}

const RecurringTemplatesList = () => {
  const queryClient = useQueryClient();
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<RecurringClassTemplate | null>(null);
  const [templateToEdit, setTemplateToEdit] = useState<RecurringClassTemplate | null>(null);

  const { data: templates, isLoading } = useQuery<RecurringClassTemplate[]>({
    queryKey: ['recurringClassTemplates'],
    queryFn: fetchRecurringClassTemplates,
    staleTime: 1000 * 60 * 5,
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      // Antes de deletar o template, precisamos deletar as aulas futuras geradas por ele.
      const { error: deleteClassesError } = await supabase
        .from('classes')
        .delete()
        .eq('recurring_class_template_id', templateId)
        .gte('start_time', new Date().toISOString()); // Apenas aulas futuras

      if (deleteClassesError) throw deleteClassesError;

      const { error } = await supabase.from('recurring_class_templates').delete().eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringClassTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] }); // Invalida a agenda
      showSuccess('Modelo de recorrência e aulas futuras excluídas com sucesso!');
      setDeleteAlertOpen(false);
      setTemplateToDelete(null);
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleDeleteClick = (template: RecurringClassTemplate) => {
    setTemplateToDelete(template);
    setDeleteAlertOpen(true);
  };

  const handleEditClick = (template: RecurringClassTemplate) => {
    setTemplateToEdit(template);
    setEditDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (templateToDelete) {
      deleteMutation.mutate(templateToDelete.id);
    }
  };

  if (isLoading) {
    return <FinancialTableSkeleton columns={5} rows={3} />;
  }

  return (
    <Card className="shadow-impressionist shadow-subtle-glow">
      <CardHeader>
        <CardTitle className="flex items-center">
          <CalendarDays className="w-5 h-5 mr-2" /> Modelos de Aulas Recorrentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {templates && templates.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(template => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.title}</TableCell>
                  <TableCell>{template.students?.name || '-'}</TableCell>
                  <TableCell>
                    {template.recurrence_pattern.map((pattern) => (
                      <div key={pattern.day} className="text-xs text-muted-foreground">
                        {DAYS_OF_WEEK_MAP[pattern.day]} às {pattern.time}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell>
                    {format(parseISO(template.recurrence_start_date), 'dd/MM/yyyy')}
                    {' - '}
                    {template.recurrence_end_date ? format(parseISO(template.recurrence_end_date), 'dd/MM/yyyy') : 'Sem fim'}
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
                        <DropdownMenuItem onClick={() => handleEditClick(template)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(template)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum modelo de aula recorrente cadastrado.
          </div>
        )}
      </CardContent>
      <DeleteRecurringTemplateAlertDialog
        isOpen={isDeleteAlertOpen}
        onOpenChange={setDeleteAlertOpen}
        templateTitle={templateToDelete?.title}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
      <EditRecurringClassTemplateDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setEditDialogOpen}
        template={templateToEdit}
      />
    </Card>
  );
};

export default RecurringTemplatesList;