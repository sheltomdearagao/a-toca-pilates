import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClassEvent, ClassAttendee, AttendanceStatus } from '@/types/schedule';
import { Student } from '@/types/student';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, UserPlus, Check, X } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClassDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  classEvent: Partial<ClassEvent> | null;
}

const fetchClassDetails = async (classId: string): Promise<ClassEvent | null> => {
  const { data, error } = await supabase.from('classes').select('*').eq('id', classId).single();
  if (error) throw new Error(error.message);
  return data;
};

const fetchAttendees = async (classId: string): Promise<ClassAttendee[]> => {
  const { data, error } = await supabase.from('class_attendees').select('id, status, students(*)').eq('class_id', classId);
  if (error) throw new Error(error.message);
  return data as unknown as ClassAttendee[] || [];
};

const fetchAllStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase.from('students').select('*').order('name');
  if (error) throw new Error(error.message);
  return data || [];
};

const ClassDetailsDialog = ({ isOpen, onOpenChange, classEvent }: ClassDetailsDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);

  const classId = classEvent?.id;

  const { data: details, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId!),
    enabled: !!classId,
  });

  const { data: attendees, isLoading: isLoadingAttendees } = useQuery({
    queryKey: ['classAttendees', classId],
    queryFn: () => fetchAttendees(classId!),
    enabled: !!classId,
  });

  const { data: allStudents } = useQuery({ queryKey: ['students'], queryFn: fetchAllStudents });

  const addAttendeeMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !classId) throw new Error('Dados inválidos.');
      const { error } = await supabase.from('class_attendees').insert({
        user_id: user.id,
        class_id: classId,
        student_id: studentId,
        status: 'Agendado',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classId] });
      showSuccess('Aluno adicionado à aula!');
      setSelectedStudentId(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string, status: AttendanceStatus }) => {
      const { error } = await supabase.from('class_attendees').update({ status }).eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classId] });
      showSuccess('Status de presença atualizado.');
    },
    onError: (error) => { showError(error.message); },
  });

  const deleteClassMutation = useMutation({
    mutationFn: async () => {
      if (!classId) throw new Error("ID da aula não encontrado.");
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess("Aula excluída com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => { showError(error.message); }
  });

  const availableStudents = allStudents?.filter(s => !attendees?.some(a => a.students.id === s.id));

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          {isLoadingDetails ? <Loader2 className="w-8 h-8 animate-spin" /> : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{details?.title}</DialogTitle>
                <DialogDescription>
                  {details && `${format(new Date(details.start_time), "eeee, dd 'de' MMMM", { locale: ptBR })} das ${format(new Date(details.start_time), 'HH:mm')} às ${format(new Date(details.end_time), 'HH:mm')}`}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Controle de Presença</h4>
                  <div className="space-y-2">
                    {isLoadingAttendees ? <Loader2 className="w-5 h-5 animate-spin" /> :
                      attendees?.map(attendee => (
                        <div key={attendee.id} className="flex items-center justify-between p-2 rounded-md bg-secondary">
                          <span>{attendee.students.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              attendee.status === 'Presente' ? 'default' :
                              attendee.status === 'Faltou' ? 'destructive' : 'secondary'
                            }>{attendee.status}</Badge>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateStatusMutation.mutate({ attendeeId: attendee.id, status: 'Presente' })}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateStatusMutation.mutate({ attendeeId: attendee.id, status: 'Faltou' })}>
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Adicionar Aluno à Aula</h4>
                  <div className="flex gap-2">
                    <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ''}>
                      <SelectTrigger><SelectValue placeholder="Selecione um aluno..." /></SelectTrigger>
                      <SelectContent>
                        {availableStudents?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => selectedStudentId && addAttendeeMutation.mutate(selectedStudentId)} disabled={!selectedStudentId || addAttendeeMutation.isPending}>
                      <UserPlus className="w-4 h-4 mr-2" /> Adicionar
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter className="sm:justify-between">
                <Button variant="destructive" onClick={() => setDeleteAlertOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir Aula
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">Fechar</Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a aula "{details?.title}"? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteClassMutation.mutate()} className="bg-destructive hover:bg-destructive/90">
              {deleteClassMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClassDetailsDialog;