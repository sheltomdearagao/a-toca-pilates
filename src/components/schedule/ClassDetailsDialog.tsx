import React, { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Clock, Calendar, Check, X, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { ClassEvent, ClassAttendee, AttendanceStatus } from '@/types/schedule';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

interface ClassDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  classEvent: ClassEvent | null;
  classCapacity: number;
}

const fetchClassAttendees = async (classId: string): Promise<ClassAttendee[]> => {
  const { data, error } = await supabase
    .from('class_attendees')
    .select(`
      id,
      status,
      students(name, enrollment_type)
    `)
    .eq('class_id', classId)
    // Order by the joined students.name using foreignTable to avoid Supabase order parsing errors
    .order('name', { foreignTable: 'students', ascending: true });

  if (error) throw new Error(error.message);
  return (data as any[] || []);
};

const ClassDetailsDialog = ({ isOpen, onOpenChange, classEvent, classCapacity }: ClassDetailsDialogProps) => {
  const queryClient = useQueryClient();
  const [attendees, setAttendees] = useState<ClassAttendee[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);

  // Usar useEffect para buscar dados quando o diálogo abre
  useEffect(() => {
    if (isOpen && classEvent?.id) {
      setIsLoadingAttendees(true);
      fetchClassAttendees(classEvent.id)
        .then((data) => {
          setAttendees(data);
        })
        .catch((error) => {
          showError(error.message);
        })
        .finally(() => {
          setIsLoadingAttendees(false);
        });
    } else {
      setAttendees([]);
    }
  }, [isOpen, classEvent?.id]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: AttendanceStatus }) => {
      const { error } = await supabase
        .from('class_attendees')
        .update({ status })
        .eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent?.id] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Status da presença atualizado com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const removeAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase
        .from('class_attendees')
        .delete()
        .eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classAttendees', classEvent?.id] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Participante removido com sucesso!');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleUpdateStatus = useCallback((attendeeId: string, status: AttendanceStatus) => {
    updateStatusMutation.mutate({ attendeeId, status });
  }, [updateStatusMutation]);

  const handleRemoveAttendee = useCallback((attendeeId: string) => {
    removeAttendeeMutation.mutate(attendeeId);
  }, [removeAttendeeMutation]);

  if (!classEvent) return null;

  const startTime = parseISO(classEvent.start_time);
  const endTime = new Date(startTime.getTime() + classEvent.duration_minutes * 60000);

  const getStatusVariant = (status: AttendanceStatus) => {
    switch (status) {
      case 'Presente': return 'attendance-present';
      case 'Faltou': return 'attendance-absent';
      case 'Agendado': return 'attendance-scheduled';
      default: return 'secondary';
    }
  };

  const getEnrollmentCode = (enrollmentType?: string) => {
    switch (enrollmentType) {
      case 'Wellhub': return 'G';
      case 'TotalPass': return 'T';
      default: return 'P';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalheses da Aula</DialogTitle>
          <DialogDescription>
            {format(startTime, "eeee, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })} ({classEvent.duration_minutes} min)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Título</h4>
            <p>{classEvent.title}</p>
          </div>
          {classEvent.notes && (
            <div className="space-y-2">
              <h4 className="font-semibold">Notas</h4>
              <p className="text-sm text-muted-foreground">{classEvent.notes}</p>
            </div>
          )}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Participantes ({attendees.length}/{classCapacity})
            </h4>
            {isLoadingAttendees ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {attendees.length > 0 ? (
                  attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">{attendee.students?.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {getEnrollmentCode(attendee.students?.enrollment_type)}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getStatusVariant(attendee.status as AttendanceStatus)}>
                          {attendee.status}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleUpdateStatus(attendee.id, 'Presente')}
                          title="Marcar como Presente"
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleUpdateStatus(attendee.id, 'Faltou')}
                          title="Marcar como Faltou"
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleRemoveAttendee(attendee.id)}
                          title="Remover Participante"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum participante nesta aula.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClassDetailsDialog;