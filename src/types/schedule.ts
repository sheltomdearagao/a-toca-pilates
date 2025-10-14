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