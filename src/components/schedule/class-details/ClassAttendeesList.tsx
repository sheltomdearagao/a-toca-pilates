import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, Trash2 } from 'lucide-react';
import type { ClassAttendee, AttendanceStatus } from '@/types/schedule';
import { Link } from 'react-router-dom';

interface ClassAttendeesListProps {
  attendees: ClassAttendee[] | undefined;
  isLoadingAttendees: boolean;
  classCapacity: number;
  onUpdateStatus: (attendeeId: string, status: AttendanceStatus) => void;
  onRemoveAttendee: (attendee: ClassAttendee) => void;
}

const ClassAttendeesList = ({
  attendees,
  isLoadingAttendees,
  classCapacity,
  onUpdateStatus,
  onRemoveAttendee,
}: ClassAttendeesListProps) => {
  return (
    <div>
      <h4 className="font-semibold mb-2">Controle de Presença ({attendees?.length || 0}/{classCapacity})</h4>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {isLoadingAttendees ? <Loader2 className="w-5 h-5 animate-spin" /> :
          attendees?.map(attendee => (
            <div key={attendee.id} className="flex items-center justify-between p-2 rounded-md bg-secondary">
              <span>
                {attendee.students?.id ? (
                  <Link to={`/alunos/${attendee.students.id}`} className="font-medium hover:underline hover:text-primary">
                    {attendee.students?.name}
                  </Link>
                ) : (
                  attendee.students?.name
                )}
                {attendee.students?.enrollment_type && (
                  <Badge variant="outline" className="ml-2">{attendee.students.enrollment_type}</Badge>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={
                  attendee.status === 'Presente' ? 'attendance-present' :
                  attendee.status === 'Faltou' ? 'attendance-absent' :
                  'attendance-scheduled'
                }>{attendee.status}</Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onUpdateStatus(attendee.id, 'Presente')}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onUpdateStatus(attendee.id, 'Faltou')}>
                  <X className="h-4 w-4 text-red-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemoveAttendee(attendee)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
};

export default ClassAttendeesList;