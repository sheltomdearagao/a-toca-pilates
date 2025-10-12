import { Student } from './student';

export type ClassEvent = {
  id: string;
  user_id: string;
  title: string;
  start_time: string; // ISO string
  end_time: string; // ISO string
  notes: string | null;
  created_at: string;
  class_attendees: { count: number }[];
};

export type AttendanceStatus = 'Agendado' | 'Presente' | 'Faltou';

export type ClassAttendee = {
  id: string;
  status: AttendanceStatus;
  students: Student;
};