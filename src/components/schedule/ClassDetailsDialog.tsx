import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, UserPlus, Check, X, Edit } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CLASS_CAPACITY = 10;

const classSchema = z.object({
  title: z.string().min(3, 'O título é obrigatório.'),
  start_time: z.string().min(1, 'A data e hora de início são obrigatórias.'),
  end_time: z.string().min(1, 'A data e hora de fim são obrigatórias.'),
  notes: z.string().optional(),
}).refine(data => new Date(data.end_time) > new Date(data.start_time), {
  message: 'A hora de fim deve ser posterior à hora de início.',
  path: ['end_time'],
});

type ClassFormData = z.infer<typeof classSchema>;

interface ClassDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  classEvent: Partial<ClassEvent> | null;
}

const fetchClassDetails = async (classId: string): Promise<Partial<ClassEvent> | null> => {
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
  const [isEditMode, setIsEditMode] = useState(false);

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

  const { control, handleSubmit, reset, formState: { errors } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      title: '',
      start_time: '',
      end_time: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (details && isEditMode) {
      reset({
        title: details.title || '',
        start_time: details.start_time ? format(parseISO(details.start_time), "yyyy-MM-dd'T'HH:mm") : '',
        end_time: details.end_time ? format(parseISO(details.end_time), "yyyy-MM-dd'T'HH:mm") : '',
        notes: details.notes || '',
      });
    }
  }, [details, isEditMode, reset]);

  const addAttendeeMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if ((attendees?.length || 0) >= CLASS_CAPACITY) {
        throw new Error("A turma já está cheia.");
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !classId) throw new Error('Dados inválidos.');
      const { error } = await supabase.from('class_attendees').insert({
        user_id: user.id,
        class_id: classId,
        status: 'Agendado',
        student_id: studentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
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

  const updateClassMutation = useMutation({
    mutationFn: async (formData: ClassFormData) => {
      if (!classId) throw new Error("ID da aula não encontrado.");
      const dataToSubmit = {
        title: formData.title,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        notes: formData.notes,
      };
      const { error } = await supabase.from('classes').update(dataToSubmit).eq('id', classId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classDetails', classId] });
      showSuccess('Aula atualizada com sucesso!');
      setIsEditMode(false);
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
  const isClassFull = (attendees?.length || 0) >= CLASS_CAPACITY;

  const handleEditSubmit = (data: ClassFormData) => {
    updateClassMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); setIsEditMode(false); }}>
        <DialogContent className="sm:max-w-lg">
          {isLoadingDetails ? <Loader2 className="w-8 h-8 animate-spin" /> : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {isEditMode ? "Editar Aula" : details?.title}
                </DialogTitle>
                {!isEditMode && (
                  <DialogDescription>
                    {details && details.start_time && details.end_time && `${format(new Date(details.start_time), "eeee, dd 'de' MMMM", { locale: ptBR })} das ${format(new Date(details.start_time), 'HH:mm')} às ${format(new Date(details.end_time), 'HH:mm')}`}
                  </DialogDescription>
                )}
              </DialogHeader>

              {isEditMode ? (
                <form onSubmit={handleSubmit(handleEditSubmit)}>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Título da Aula</Label>
                      <Controller name="title" control={control} render={({ field }) => <Input id="title" {...field} />} />
                      {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_time">Início</Label>
                        <Controller name="start_time" control={control} render={({ field }) => <Input id="start_time" type="datetime-local" {...field} />} />
                        {errors.start_time && <p className="text-sm text-destructive mt-1">{errors.start_time.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_time">Fim</Label>
                        <Controller name="end_time" control={control} render={({ field }) => <Input id="end_time" type="datetime-local" {...field} />} />
                        {errors.end_time && <p className="text-sm text-destructive mt-1">{errors.end_time.message}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notas (Opcional)</Label>
                      <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" {...field} />} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setIsEditMode(false)}>Cancelar</Button>
                    <Button type="submit" disabled={updateClassMutation.isPending}>
                      {updateClassMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar Alterações
                    </Button>
                  </DialogFooter>
                </form>
              ) : (
                <>
                  <div className="py-4 space-y-6">
                    <div>
                      <h4 className="font-semibold mb-2">Controle de Presença ({attendees?.length || 0}/{CLASS_CAPACITY})</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
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
                      {isClassFull ? (
                        <div className="text-center p-4 bg-red-100 text-red-700 rounded-md">
                          <p className="font-bold">Turma cheia!</p>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ''} disabled={isClassFull}>
                            <SelectTrigger><SelectValue placeholder="Selecione um aluno..." /></SelectTrigger>
                            <SelectContent>
                              {availableStudents?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button onClick={() => selectedStudentId && addAttendeeMutation.mutate(selectedStudentId)} disabled={!selectedStudentId || addAttendeeMutation.isPending || isClassFull}>
                            <UserPlus className="w-4 h-4 mr-2" /> Adicionar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="sm:justify-between">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditMode(true)}>
                        <Edit className="w-4 h-4 mr-2" /> Editar Aula
                      </Button>
                      <Button variant="destructive" onClick={() => setDeleteAlertOpen(true)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir Aula
                      </Button>
                    </div>
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">Fechar</Button>
                    </DialogClose>
                  </DialogFooter>
                </>
              )}
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