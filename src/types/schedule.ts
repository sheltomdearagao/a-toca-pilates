import { Student } from './student';

export type ClassEvent = {
  id: string;
  user_id: string;
  title: string;
  start_time: string; // Alterado para string (ISO 8601)
  end_time: string;   // Alterado para string (ISO 8601)
  notes: string | null;
  created_at: string;
  student_id: string | null; // Novo campo para vincular a um aluno
  class_attendees: { count: number }[];
  students?: { name: string }; // Para o join na query
};

export type RecurringClassTemplate = {
  id: string;
  user_id: string;
  title: string;
  start_time_of_day: string; // HH:mm:ss
  end_time_of_day: string; // HH:mm:ss
  notes: string | null;
  recurrence_days_of_week: string[]; // e.g., ['monday', 'wednesday']
  recurrence_start_date: string; // YYYY-MM-DD
  recurrence_end_date: string | null; // YYYY-MM-DD
  created_at: string;
};

export type AttendanceStatus = 'Agendado' | 'Presente' | 'Faltou';

export type ClassAttendee = {
  id: string;
  status: AttendanceStatus;
  students: Student;
};