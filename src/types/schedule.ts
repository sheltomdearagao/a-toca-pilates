import { Student } from './student';

export type ClassEvent = {
  id: string;
  user_id: string;
  title: string;
  start_time: string; // Alterado para string (ISO 8601)
  duration_minutes: number; // Nova coluna
  notes: string | null;
  created_at: string;
  student_id: string | null; // Novo campo para vincular a um aluno
  class_attendees: { count: number }[];
  students?: { name: string }; // Para o join na query
};

export type AttendanceStatus = 'Agendado' | 'Presente' | 'Faltou';

export type ClassAttendee = {
  id: string;
  status: AttendanceStatus;
  students: Student;
};

// Novos tipos para aulas recorrentes
export type RecurrencePatternItem = {
  day: string; // 'monday', 'tuesday', etc.
  time: string; // 'HH:mm'
};

export type RecurringClassTemplate = {
  id: string;
  user_id: string;
  student_id: string | null;
  title: string;
  duration_minutes: number;
  notes: string | null;
  recurrence_pattern: RecurrencePatternItem[];
  recurrence_start_date: string; // ISO date string
  recurrence_end_date: string | null; // ISO date string
  created_at: string;
  students?: { name: string }; // Para join
};