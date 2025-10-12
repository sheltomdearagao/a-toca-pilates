import { FinancialTransaction, TransactionType } from "@/types/financial";
import { Student } from "@/types/student";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useForm, Controller, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import React, { useEffect } from "react";
import { useAppSettings } from '@/hooks/useAppSettings'; // Importar o hook

const transactionSchema = z.object({
  description: z.string().min(3, "A descrição é obrigatória."),
  amount: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive("O valor deve ser positivo.")
  ),
  type: z.enum(["revenue", "expense"]),
  category: z.string().min(1, "A categoria é obrigatória."),
  student_id: z.string().optional().nullable(),
  status: z.enum(["Pendente", "Pago", "Atrasado"]).optional().nullable(),
  due_date: z.date().optional().nullable(),
  // is_recurring field removed as it's now managed by templates
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

interface AddEditTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedTransaction: FinancialTransaction | null;
  students: Student[] | undefined;
  isLoadingStudents: boolean;
  onSubmit: (data: TransactionFormData) => void;
  isSubmitting: boolean;
}

const AddEditTransactionDialog = ({
  isOpen,
  onOpenChange,
  selectedTransaction,
  students,
  isLoadingStudents,
  onSubmit,
  isSubmitting,
}: AddEditTransactionDialogProps) => {
  const { control, handleSubmit, reset, watch, setValue } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { description: "", amount: 0, type: "revenue", category: "", student_id: null, status: "Pendente", due_date: new Date() },
  });

  const transactionType = watch("type");
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();

  const revenueCategories = appSettings?.revenue_categories || ["Mensalidade", "Aula Avulsa", "Venda de Produto", "Outras Receitas"];
  const expenseCategories = appSettings?.expense_categories || ["Aluguel", "Salários", "Marketing", "Material", "Contas", "Outras Despesas"];

  useEffect(() => {
    if (isOpen) {
      if (selectedTransaction) {
        reset({
          description: selectedTransaction.description,
          amount: selectedTransaction.amount,
          type: selectedTransaction.type,
          category: selectedTransaction.category,
          student_id: selectedTransaction.student_id,
          status: selectedTransaction.status,
          due_date: selectedTransaction.due_date ? parseISO(selectedTransaction.due_date) : null,
          // is_recurring is not part of the form anymore
        });
      } else {
        reset({ description: "", amount: 0, type: "revenue", category: "", student_id: null, status: "Pendente", due_date: new Date() });
      }
    }
  }, [isOpen, selectedTransaction, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-lg transition-all",
        transactionType === 'revenue' && "border-t-4 border-green-300",
        transactionType === 'expense' && "border-t-4 border-red-300"
      )}>
        <DialogHeader>
          <DialogTitle>{selectedTransaction ? "Editar Lançamento" : "Adicionar Novo Lançamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className={cn(
            "grid gap-4 py-4 rounded-lg p-4 transition-all",
            transactionType === 'revenue' && "bg-green-50/30",
            transactionType === 'expense' && "bg-red-50/30"
          )}>
            <Controller name="type" control={control} render={({ field }) => (
                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                  <div><RadioGroupItem value="revenue" id="r1" className="peer sr-only" /><Label htmlFor="r1" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Receita</Label></div>
                  <div><RadioGroupItem value="expense" id="r2" className="peer sr-only" /><Label htmlFor="r2" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Despesa</Label></div>
                </RadioGroup>
            )} />
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Controller name="description" control={control} render={({ field }) => <Input id="description" {...field} />} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor</Label>
                <Controller name="amount" control={control} render={({ field }) => <Input id="amount" type="number" step="0.01" {...field} />} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Controller name="category" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {isLoadingSettings ? (
                          <SelectItem value="loading" disabled>Carregando...</SelectItem>
                        ) : (transactionType === 'revenue' ? revenueCategories : expenseCategories).map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                      </SelectContent>
                    </Select>
                )} />
              </div>
            </div>
            {transactionType === 'revenue' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="student_id">Aluno (Opcional)</Label>
                  <Controller name="student_id" control={control} render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <SelectTrigger><SelectValue placeholder="Selecione um aluno..." /></SelectTrigger>
                        <SelectContent>{isLoadingStudents ? <SelectItem value="loading" disabled>Carregando...</SelectItem> : students?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Data de Vencimento</Label>
                    <Controller name="due_date" control={control} render={({ field }) => <Input id="due_date" type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => field.onChange(e.target.valueAsDate)} />} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Controller name="status" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent><SelectItem value="Pendente">Pendente</SelectItem><SelectItem value="Pago">Pago</SelectItem><SelectItem value="Atrasado">Atrasado</SelectItem></SelectContent>
                        </Select>
                    )} />
                  </div>
                </div>
              </>
            )}
            {/* is_recurring checkbox removed for expenses */}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditTransactionDialog;