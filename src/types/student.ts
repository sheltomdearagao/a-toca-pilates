export type StudentStatus = 'Ativo' | 'Inativo' | 'Experimental' | 'Bloqueado';
export type PlanType = 'Mensal' | 'Trimestral' | 'Avulso';
export type PlanFrequency = '2x' | '3x' | '4x' | '5x';
export type PaymentMethod = 'Cartão' | 'Espécie';
export type EnrollmentType = 'Particular' | 'Wellhub' | 'TotalPass'; // Novo tipo

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
  enrollment_type: EnrollmentType; // Novo campo
  date_of_birth?: string | null; // Novo campo
  validity_date?: string | null; // Novo campo de validade
  preferred_days?: string[] | null; // Novo campo
  preferred_time?: string | null; // Novo campo
};

// Novo tipo para uso em dropdowns e seletores de aluno
export type StudentOption = Pick<Student, 'id' | 'name' | 'enrollment_type'>;