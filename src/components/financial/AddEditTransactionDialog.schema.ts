import { z } from 'zod';

export const transactionSchema = z.object({
  type: z.enum(['revenue', 'expense']),
  student_id: z.string().nullable(),
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.preprocess(
    (val) => typeof val === 'string' ? parseFloat(val) : val,
    z.number().min(0, 'Valor deve ser positivo')
  ),
  category: z.string().min(1, 'Categoria é obrigatória'),
  status: z.enum(['Pago', 'Pendente', 'Atrasado']),
  due_date: z.string().nullable(),
}).superRefine((data, ctx) => {
  // Torna due_date obrigatório apenas se for receita e categoria for Mensalidade
  if (data.type === 'revenue' && data.category === 'Mensalidade' && (!data.due_date || data.due_date.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Data de vencimento é obrigatória para mensalidades',
      path: ['due_date'],
    });
  }
});

export type TransactionFormData = z.infer<typeof transactionSchema>;