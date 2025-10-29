import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Check, Trash2 } from 'lucide-react';
import { startOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { ClassEvent, ClassAttendee, AttendanceStatus } from '@/types/schedule';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import EditClassDialog from './class-details/EditClassDialog';
import { supabase } from '@/integrations/supabase/client';

interface ClassDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classEvent: ClassEvent | null;
  classCapacity: number;
}

const fetchClassAttendees = async (classId: string): Promise<ClassAttendee[]> => {
  const { data, error } = await supabase
    .from('class_attendees')
    .select('id, status, students(name, enrollment_type)')
    .eq('class_id', classId);

  if (error) throw error;

  // Normalize to the ClassAttendee shape, where attendees[].students is an array
  const raw = (data as any[]) ?? [];
  const normalized: ClassAttendee[] = raw.map((row) => {
    const students = row.students ?? [];
    const studentsArray = Array.isArray(students) ? students : [students];
    return {
      id: row.id,
      status: row.status,
      students: (studentsArray.filter(Boolean).map((s: any) => ({
        name: s.name,
        enrollment_type: s.enrollment_type,
      })) as any),
    } as ClassAttendee;
  });

  return normalized;
};

const ClassDetailsDialog = ({
  isOpen,
  onOpenChange,
  classEvent,
  classCapacity,
}: ClassDetailsDialogProps) => {
  const [attendees, setAttendees] = useState<ClassAttendee[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);

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

  if (!classEvent) return null;

  const startTime = new Date(classEvent.start_time);
  const endTime = new Date(startTime.getTime() + classEvent.duration_minutes * 60000);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Aula</DialogTitle>
          <DialogDescription>
            {format(startTime, "eeee, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })} ({classEvent.duration_minutes} min)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Título</span>
            <span>{classEvent.title}</span>
          </div>

          <EditClassDialog isOpen={isEditOpen} onOpenChange={setEditOpen} classEvent={classEvent} />

          <div>
            <h4 className="font-semibold mb-2">Participantes</h4>
            {isLoadingAttendees ? (
              <div>Carregando participantes...</div>
            ) : (
              <div className="space-y-2">
                {attendees.map((attendee) => {
                  // Attendee may have attendees.students as an array
                  const firstStudent = Array.isArray(attendee.students) ? attendee.students[0] : attendee.students?.[0];
                  const name = firstStudent?.name;
                  const enrollment = firstStudent?.enrollment_type;

                  return (
                    <div key={attendee.id} className="flex items-center justify-between p-2 border rounded bg-secondary/20">
                      <div className="flex items-center gap-2">
                        <span>{name || 'Aluno'}</span>
                        <span className="text-xs text-muted-foreground">{enrollment}</span>
                      </div>
                      <span className="text-sm">Status: {attendee.status}</span>
                    </div>
                  );
                })}
                {attendees.length === 0 && <div>Nenhum participante nesta aula.</div>}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClassDetailsDialog;