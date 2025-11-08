import { Student } from './student';
import { EnrollmentType } from './student';

export type ClassEvent = {
  id: string;
  user_id: string;
  title: string;
  start_time: string; // ISO 8601
  duration_minutes: number; // duration in minutes
  notes: string | null;
  created_at: string;
  student_id: string | null;
  recurring_class_template_id: string | null;
  class_attendees: { count: number }[];
  students?: { name: string; enrollment_type?: EnrollmentType };
  
  // NOVO: Lista de nomes dos participantes para exibição no card
  attendee_names?: string[]; 
};

export type AttendanceStatus = 'Agendado' | 'Presente' | 'Faltou';
export type AttendanceType = 'Recorrente' | 'Pontual' | 'Experimental' | 'Reposicao'; // NOVO TIPO

// New types to support enrollment-aware UI in schedule
export type RecurrencePatternItem = {
  day: string;
  time: string;
};

export interface RecurringClassTemplate {
  id: string;
  user_id?: string;
  student_id?: string | null;
  title: string;
  notes?: string | null;
  duration_minutes?: number;
  recurrence_start_date: string;
  recurrence_end_date?: string | null;
  created_at?: string;
  recurrence_pattern?: RecurrencePatternItem[];
  // Optional joined student info
  students?: { name?: string; enrollment_type?: EnrollmentType };
}

export interface ClassAttendee {
  id: string;
  user_id?: string;
  class_id?: string;
  student_id?: string | null;
  status?: AttendanceStatus;
  attendance_type?: AttendanceType; // NOVO CAMPO
  // Agora inclui id para permitir navegação ao perfil
  students?: { id?: string; name?: string; enrollment_type?: EnrollmentType };
}