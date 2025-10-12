import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { ClassEvent, ClassAttendee, AttendanceStatus } from '@/types/schedule';
import { Student, StudentOption } from '@/types/student'; // Importar StudentOption
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
import { Loader2, Trash2, UserPlus, Check, X, Edit, CheckCircle, ChevronsUpDown } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const classSchema = z.object({
  student_id: z.string().optional().nullable(),
  title: z.string().min(3, 'O título é obrigatório.').optional(),
  start_time: z.string().min(1, 'A data e hora de início são obrigatórias.'),
  end_time: z.string().min(1, 'A data e hora de fim são obrigatórias.'),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (new Date(data.end_time) <= new Date(data.start_time)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A hora de fim deve ser posterior à hora de início.',
      path: ['end_time'],
    });
  }
  if (!data.student_id && (!data.title || data.title.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O título da aula é obrigatório se nenhum aluno for selecionado.',
      path: ['title'],
    });
  }
});

type ClassFormData = z.infer<typeof classSchema>;

interface ClassDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  classEvent: Partial<ClassEvent> | null;
  classCapacity: number;
}

const fetchClassDetails = async (classId: string): Promise<Partial<ClassEvent> | null> => {
  const { data, error } = await supabase.from('classes').select('*, students(name)').eq('id', classId).single();
  if (error) throw new Error(error.message);
  return data;
};

const fetchAttendees = async (classId: string): Promise<ClassAttendee[]> => {
  const { data, error } = await supabase.from('class_attendees').select('id, status, students(id, name, enrollment_type)').eq('class_id', classId);
  if (error) throw new Error(error.message);
  return data as unknown as ClassAttendee[] || [];
};

const fetchAllStudents = async (): Promise<StudentOption[]> => { // Usar StudentOption
  const { data, error } = await supabase.from('students').select('id, name, enrollment_type').order('name'); // Selecionar enrollment_type
  if (error) throw new Error(error.message);
  return data || [];
};

const ClassDetailsDialog = ({ isOpen, onOpenChange, classEvent, classCapacity }: ClassDetailsDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedStudentIdToAdd, setSelectedStudentIdToAdd] = useState<string | null>(null); // Renamed to avoid conflict
  const [isDeleteClassAlertOpen, setDeleteClassAlertOpen] = useState(false);
  const [isDeleteAttendeeAlertOpen, setDeleteAttendeeAlertOpen] = useState(false);
  const [attendeeToDelete, setAttendeeToDelete] = useState<ClassAttendee | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDisplaceConfirmationOpen, setDisplaceConfirmationOpen] = useState(false);
  const [studentToDisplace, setStudentToDisplace] = useState<ClassAttendee | null>(null);
  const [newStudentForDisplacement, setNewStudentForDisplacement] = useState<StudentOption | null>(null); // Usar StudentOption


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

  const { data: allStudents, isLoading: isLoadingAllStudents } = useQuery<StudentOption[]>({ queryKey: ['allStudents'], queryFn: fetchAllStudents }); // Usar StudentOption

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      student_id: null,
      title: '',
      start_time: '',
      end_time: '',
      notes: '',
    },
  });

  const selectedStudentIdInEdit = watch('student_id'); // Watch student_id in edit mode

  useEffect(() => {
    if (details && isEditMode) {
      reset({
        title: details.title || '',
        start_time: details.start_time ? format(parseISO(details.start_time), "yyyy-MM-dd'T'HH:mm") : '',
        end_time: details.end_time ? format(parseISO(details.end_time), "yyyy-MM-dd'T'HH:mm") : '',
        notes: details.notes || '',
        student_id: details.student_id || null,
      });
    }
  }, [details, isEditMode, reset]);

  const addAttendeeMutation = useMutation({
    mutationFn: async ({ studentId, displaceAttendeeId }: { studentId: string, displaceAttendeeId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !classId) throw new Error('Dados inválidos.');

      if (displaceAttendeeId) {
        // Perform a batch update: delete old, insert new
        const { error: deleteError } = await supabase.from('class_attendees').delete().eq('id', displaceAttendeeId);
        if (deleteError) throw deleteError;
      }

      const { error: insertError } = await supabase.from('class_attendees').insert({
        user_id: user.id,
        class_id: classId,
        status: 'Agendado',
        student_id: studentId,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Aluno adicionado à aula!');
      setSelectedStudentIdToAdd(null);
      setDisplaceConfirmationOpen(false);
      setStudentToDisplace(null);
      setNewStudentForDisplacement(null);
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

  const removeAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase.from('class_attendees').delete().eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] }); // To update attendee count on calendar
      showSuccess('Aluno removido da aula!');
      setDeleteAttendeeAlertOpen(false);
      setAttendeeToDelete(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const updateClassMutation = useMutation({
    mutationFn: async (formData: ClassFormData) => {
      if (!classId) throw new Error("ID da aula não encontrado.");
      const classTitle = formData.student_id
        ? allStudents?.find(s => s.id === formData.student_id)?.name || 'Aula com Aluno'
        : formData.title;

      const dataToSubmit = {
        title: classTitle,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        notes: formData.notes,
        student_id: formData.student_id || null,
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

  const availableStudentsForAdd = allStudents?.filter(s => !attendees?.some(a => a.students.id === s.id));
  const isClassFull = (attendees?.length || 0) >= classCapacity;

  const handleEditSubmit = (data: ClassFormData) => {
    updateClassMutation.mutate(data);
  };

  const confirmRemoveAttendee = (attendee: ClassAttendee) => {
    setAttendeeToDelete(attendee);
    setDeleteAttendeeAlertOpen(true);
  };

  const handleAddStudentClick = () => {
    if (!selectedStudentIdToAdd) {
      showError("Selecione um aluno para adicionar.");
      return;
    }

    const studentToAdd = allStudents?.find(s => s.id === selectedStudentIdToAdd);
    if (!studentToAdd) {
      showError("Aluno não encontrado.");
      return;
    }

    if (!isClassFull) {
      addAttendeeMutation.mutate({ studentId: studentToAdd.id });
    } else {
      // Class is full, check for priority displacement
      if (studentToAdd.enrollment_type === 'Particular') {
        const displaceableStudents = attendees?.filter(
          a => a.students.enrollment_type === 'Wellhub' || a.students.enrollment_type === 'TotalPass'
        );

        if (displaceableStudents && displaceableStudents.length > 0) {
          // Displace the first found
          setStudentToDisplace(displaceableStudents[0]);
          setNewStudentForDisplacement(studentToAdd);
          setDisplaceConfirmationOpen(true);
        } else {
          showError("Turma cheia e não há alunos de menor prioridade para deslocar.");
        }
      } else {
        showError("Turma cheia. Apenas alunos 'Particulares' podem deslocar outros alunos.");
      }
    }
  };

  const handleConfirmDisplacement = () => {
    if (newStudentForDisplacement && studentToDisplace) {
      addAttendeeMutation.mutate({
        studentId: newStudentForDisplacement.id,
        displaceAttendeeId: studentToDisplace.id,
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); setIsEditMode(false); }}>
        <DialogContent className="sm:max-w-lg">
          {isLoadingDetails ? <Loader2 className="w-8 h-8 animate-spin" /> : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {isEditMode ? "Editar Aula" : (details?.students?.name ? `Aula com ${details.students.name}` : details?.title)}
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

                    {!selectedStudentIdInEdit && (
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
                      <h4 className="font-semibold mb-2">Controle de Presença ({attendees?.length || 0}/{classCapacity})</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {isLoadingAttendees ? <Loader2 className="w-5 h-5 animate-spin" /> :
                          attendees?.map(attendee => (
                            <div key={attendee.id} className="flex items-center justify-between p-2 rounded-md bg-secondary">
                              <span>{attendee.students.name} <Badge variant="outline" className="ml-2">{attendee.students.enrollment_type}</Badge></span>
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
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => confirmRemoveAttendee(attendee)}>
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
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
                        <Select onValueChange={setSelectedStudentIdToAdd} value={selectedStudentIdToAdd || ''}>
                          <SelectTrigger><SelectValue placeholder="Selecione um aluno..." /></SelectTrigger>
                          <SelectContent>
                            {availableStudentsForAdd?.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.enrollment_type})</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleAddStudentClick} disabled={!selectedStudentIdToAdd || addAttendeeMutation.isPending}>
                          <UserPlus className="w-4 h-4 mr-2" /> Adicionar
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="sm:justify-between">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditMode(true)}>
                        <Edit className="w-4 h-4 mr-2" /> Editar Aula
                      </Button>
                      <Button variant="destructive" onClick={() => setDeleteClassAlertOpen(true)}>
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

      <AlertDialog open={isDeleteClassAlertOpen} onOpenChange={setDeleteClassAlertOpen}>
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

      <AlertDialog open={isDeleteAttendeeAlertOpen} onOpenChange={setDeleteAttendeeAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aluno da aula?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover "{attendeeToDelete?.students.name}" desta aula?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => attendeeToDelete && removeAttendeeMutation.mutate(attendeeToDelete.id)} disabled={removeAttendeeMutation.isPending} className="bg-destructive hover:bg-destructive/90">
              {removeAttendeeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sim, remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDisplaceConfirmationOpen} onOpenChange={setDisplaceConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turma Cheia - Deslocar Aluno?</AlertDialogTitle>
            <AlertDialogDescription>
              A turma está cheia. O aluno **{newStudentForDisplacement?.name}** (Particular) pode ocupar a vaga de **{studentToDisplace?.students.name}** ({studentToDisplace?.students.enrollment_type}). Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDisplaceConfirmationOpen(false); setSelectedStudentIdToAdd(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisplacement} disabled={addAttendeeMutation.isPending}>
              {addAttendeeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sim, deslocar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClassDetailsDialog;