import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FinancialTransaction } from "@/types/financial";
import { Student } from "@/types/student";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusCircle, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { showError, showSuccess } from "@/utils/toast";
import { format } from "date-fns";

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
});

type TransactionFormData = z.infer<typeof transactionSchema>;

const fetchTransactions = async (): Promise<FinancialTransaction[]> => {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*, students(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
};

const fetchStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase.from("students").select("*").order("name");
  if (error) throw new Error(error.message);
  return data || [];
};

const revenueCategories = ["Mensalidade", "Aula Avulsa", "Venda de Produto", "Outras Receitas"];
const expenseCategories = ["Aluguel", "Salários", "Marketing", "Material", "Contas", "Outras Despesas"];

const Financial = () => {
  const queryClient = useQueryClient();
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);

  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
  });

  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
  });

  const { control, handleSubmit, reset, watch, setValue } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: 0,
      type: "revenue",
      category: "",
      student_id: null,
      status: "Pendente",
      due_date: new Date(),
    },
  });

  const transactionType = watch("type");

  const mutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const dataToSubmit = {
        ...formData,
        user_id: user.id,
        due_date: formData.due_date ? format(formData.due_date, "yyyy-MM-dd") : null,
        status: formData.type === 'revenue' ? formData.status : null,
        student_id: formData.type === 'revenue' ? formData.student_id : null,
      };

      if (selectedTransaction) {
        // Update
        const { error } = await supabase
          .from("financial_transactions")
          .update(dataToSubmit)
          .eq("id", selectedTransaction.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from("financial_transactions")
          .insert([dataToSubmit]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      showSuccess(`Lançamento ${selectedTransaction ? "atualizado" : "adicionado"} com sucesso!`);
      setFormOpen(false);
      setSelectedTransaction(null);
      reset();
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleAddNew = () => {
    setSelectedTransaction(null);
    reset({
      description: "",
      amount: 0,
      type: "revenue",
      category: "",
      student_id: null,
      status: "Pendente",
      due_date: new Date(),
    });
    setFormOpen(true);
  };
  
  const onSubmit = (data: TransactionFormData) => {
    mutation.mutate(data);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Módulo Financeiro</h1>
        <Button onClick={handleAddNew}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Adicionar Lançamento
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="all">Todos os Lançamentos</TabsTrigger>
          <TabsTrigger value="overdue">Inadimplência</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">...</div>
                <p className="text-xs text-muted-foreground">Carregando...</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Despesa do Mês</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">...</div>
                <p className="text-xs text-muted-foreground">Carregando...</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inadimplência</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">...</div>
                <p className="text-xs text-muted-foreground">Carregando...</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="all" className="mt-4">
           {isLoadingTransactions ? (
             <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
           ) : (
            <div className="bg-card rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions?.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell>{t.type === 'revenue' ? 'Receita' : 'Despesa'}</TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell>{t.students?.name || '-'}</TableCell>
                      <TableCell>{t.due_date ? format(new Date(t.due_date), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell>{t.status || '-'}</TableCell>
                      <TableCell className={`text-right font-bold ${t.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
           )}
        </TabsContent>
        <TabsContent value="overdue" className="mt-4">
          <p>Painel de inadimplência será implementado aqui.</p>
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedTransaction ? "Editar Lançamento" : "Adicionar Novo Lançamento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                    <div><RadioGroupItem value="revenue" id="r1" className="peer sr-only" /><Label htmlFor="r1" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Receita</Label></div>
                    <div><RadioGroupItem value="expense" id="r2" className="peer sr-only" /><Label htmlFor="r2" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Despesa</Label></div>
                  </RadioGroup>
                )}
              />
              
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
                  <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {(transactionType === 'revenue' ? revenueCategories : expenseCategories).map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {transactionType === 'revenue' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="student_id">Aluno (Opcional)</Label>
                    <Controller
                      name="student_id"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <SelectTrigger><SelectValue placeholder="Selecione um aluno..." /></SelectTrigger>
                          <SelectContent>
                            {isLoadingStudents ? <SelectItem value="loading" disabled>Carregando...</SelectItem> :
                              students?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                            }
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="due_date">Data de Vencimento</Label>
                      <Controller name="due_date" control={control} render={({ field }) => <Input id="due_date" type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => field.onChange(e.target.valueAsDate)} />} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pendente">Pendente</SelectItem>
                              <SelectItem value="Pago">Pago</SelectItem>
                              <SelectItem value="Atrasado">Atrasado</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financial;