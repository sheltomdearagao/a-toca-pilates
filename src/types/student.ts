export type StudentStatus = 'Ativo' | 'Inativo' | 'Experimental' | 'Bloqueado';
export type PlanType = 'Mensal' | 'Trimestral' | 'Avulso';
export type PlanFrequency = '2x' | '3x' | '4x' | '5x';
export type PaymentMethod = 'Cartão' | 'Espécie';

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
  plan_frequency?: PlanFrequency;
  payment_method?: PaymentMethod;
  monthly_fee?: number;
};