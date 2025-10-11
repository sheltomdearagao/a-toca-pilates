export type ClassEvent = {
  id: string;
  user_id: string;
  title: string;
  start_time: string; // ISO string
  end_time: string; // ISO string
  notes: string | null;
  created_at: string;
};