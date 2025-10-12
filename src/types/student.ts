export type StudentStatus = 'Ativo' | 'Inativo' | 'Experimental' | 'Bloqueado';
export type PlanType = 'Mensal' | 'Avulso';

export type Student = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: StudentStatus;
  notes: string | null;
  created_at: string;
  user_id: string;
  plan_type?: PlanType;
  monthly_fee?: number;
};