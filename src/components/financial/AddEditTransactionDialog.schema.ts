import { z } from 'zod';

export const transactionSchema = z.object({
  type: z.enum(['revenue', 'expense']),
  student_id: z.string().nullable(),
  description: z.string().min(1),
  amount: z.preprocess(
    (val) => typeof val === 'string' ? parseFloat(val) : val,
    z.number().min(0)
  ),
  category: z.string().min(1),
  status: z.string().min(1),
  due_date: z.string().nullable(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;