import React, { useState } from 'react';
import { Calendar, Loader2, Edit, Trash2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import FinancialTableSkeleton from '@/components/financial/FinancialTableSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ClassAttendance = {
  id: string;
  status: string;
  classes: {
    id: string;
    title: string;
    start_time: string;
  };
};

interface StudentAttendanceHistoryProps {
  attendance: ClassAttendance[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  isFetching: boolean;
  studentId: string;
  isEditable?: boolean;
}

const StudentAttendanceHistory = ({ 
  attendance, 
  isLoading, 
  hasMore, 
  onLoadMore, 
  isFetching, 
  studentId,
  isEditable = true 
}: StudentAttendanceHistoryProps) => {
  const queryClient = useQueryClient();
  const [editingAttendee, setEditingAttendee] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attendeeToDelete, setAttendeeToDelete] = useState<ClassAttendance | null>(null);

  // Sort attendance by most recent first
  const sortedAttendance = React.useMemo(() => {
    return [...attendance].sort((a, b) => 
      new Date(b.classes.start_time).getTime() - new Date(a.classes.start_time).getTime()
    );
  }, [attendance]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: string }) => {
      const { error } = await supabase
        .from('class_attendees')
        .update({ status })
        .eq('id', attendeeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentHistory', studentId] });
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', studentId] });
      showSuccess('Status de presença atualizado com sucesso!');
      setEditingAttendee(null);
    },
    onError: (error) => {
      showError('Erro ao atualizar status: ' + error.message);
    },
  });

  const deleteAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase
        .from('class_attendees')
        .delete()
        .eq('id', attendeeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentHistory', studentId] });
      queryClient.invalidateQueries({ queryKey: ['studentProfileData', studentId] });
      showSuccess('Participação removida com sucesso!');
      setDeleteDialogOpen(false);
      setAttendeeToDelete(null);
    },
    onError: (error) => {
      showError('Erro ao remover participação: ' + error.message);
    },
  });

  const handleStatusChange = (attendeeId: string, newStatus: string) => {
    updateStatusMutation.mutate({ attendeeId, status: newStatus });
  };

  const handleDeleteClick = (attendee: ClassAttendance) => {
    setAttendeeToDelete(attendee);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (attendeeToDelete) {
      deleteAttendeeMutation.mutate(attendeeToDelete.id);
    }
  };

  if (isLoading) {
    return <FinancialTableSkeleton columns={4} rows={3} />;
  }

  return (
    <>
      <Card variant="bordered-yellow" className="lg:col-span-3 shadow-impressionist shadow-subtle-glow">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" /> 
            Histórico de Presença
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedAttendance.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aula</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    {isEditable && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAttendance.map((a) => (
                    <TableRow 
                      key={a.id} 
                      className={cn(
                        "hover:bg-muted/50 transition-colors",
                        a.status === 'Presente' && "bg-green-50/5",
                        a.status === 'Faltou' && "bg-red-50/5",
                        a.status === 'Agendado' && "bg-blue-50/5"
                      )}
                    >
                      <TableCell className="font-medium">
                        {a.classes.title}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(a.classes.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {editingAttendee === a.id ? (
                          <Select
                            value={a.status}
                            onValueChange={(value) => handleStatusChange(a.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Agendado">Agendado</SelectItem>
                              <SelectItem value="Presente">Presente</SelectItem>
                              <SelectItem value="Faltou">Faltou</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={
                            a.status === 'Presente' ? 'attendance-present' :
                            a.status === 'Faltou' ? 'attendance-absent' :
                            'attendance-scheduled'
                          }>
                            {a.status}
                          </Badge>
                        )}
                      </TableCell>
                      {isEditable && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingAttendee(editingAttendee === a.id ? null : a.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDeleteClick(a)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  Exibindo {sortedAttendance.length} registros.
                </p>
                {hasMore && (
                  <Button 
                    variant="outline" 
                    onClick={onLoadMore} 
                    disabled={isFetching}
                    size="sm"
                  >
                    {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Ver Mais"}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-6xl mb-4 opacity-50">📅</div>
              <p className="text-muted-foreground">Nenhum registro de presença encontrado.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Participação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a participação de "{attendeeToDelete?.classes?.title || 'este aluno'}" na aula "{attendeeToDelete?.classes?.title}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteAttendeeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Sim, remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StudentAttendanceHistory;