import { Student } from './student';

export type TransactionType = 'revenue' | 'expense';
export type PaymentStatus = 'Pendente' | 'Pago' | 'Atrasado';

export type FinancialTransaction = {
  id: string;
  user_id: string;
  student_id: string | null;
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
  status: PaymentStatus | null;
  due_date: string | null;
  paid_at: string | null;
  is_recurring?: boolean;
  created_at: string;
  students?: Student; // For joining data
};