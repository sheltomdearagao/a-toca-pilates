export type WorkingDay = {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
};

export type InstructorStatus = 'Ativo' | 'Inativo' | 'Férias';

export type Instructor = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: InstructorStatus;
  hourly_rate: number | null;
  working_days: WorkingDay[] | null;
  created_at: string;
  updated_at: string;
};

export type InstructorOption = Pick<Instructor, 'id' | 'name'>;