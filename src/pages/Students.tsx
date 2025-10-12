import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Student, PlanType, PlanFrequency, PaymentMethod } from "@/types/student";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Loader2, MoreHorizontal, PlusCircle, UserX } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { showError, showSuccess } from "@/utils/toast";
import { Link } from "react-router-dom";

const studentSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  email: z.string().email("Email inválido.").optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["Ativo", "Inativo", "Experimental", "Bloqueado"]),
  notes: z.string().optional(),
  plan_type: z.enum(["Mensal", "Trimestral", "Avulso"]).default("Avulso"),
  plan_frequency: z.enum(["2x", "3x", "4x", "5x"]).optional(),
  payment_method: z.enum(["Cartão", "Espécie"]).optional(),
  monthly_fee: z.number().optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

const pricingTable = {
  Mensal: {
    '2x': { 'Cartão': 245, 'Espécie': 230 },
    '3x': { 'Cartão': 275, 'Espécie': 260 },
    '4x': { 'Cartão': 300, 'Espécie': 285 },
    '5x': { 'Cartão': 320, 'Espécie': 305 },
  },
  Trimestral: {
    '2x': { 'Cartão': 225, 'Espécie': 210 },
    '3x': { 'Cartão': 255, 'Espécie': 240 },
    '4x': { 'Cartão': 285, 'Espécie': 270 },
    '5x': { 'Cartão': 300, 'Espécie': 285 },
  },
};

const fetchStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase.from("students").select("*").order("name");
  if (error) throw new Error(error.message);
  return data || [];
};

const Students = () => {
  const queryClient = useQueryClient();
  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const { control, handleSubmit, reset, setValue, watch } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: "", email: "", phone: "", status: "Experimental", notes: "", plan_type: "Avulso" },
  });

  const planType = watch("plan_type");
  const planFrequency = watch("plan_frequency");
  const paymentMethod = watch("payment_method");

  useEffect(() => {
    if (planType && planType !== 'Avulso' && planFrequency && paymentMethod) {
      const fee = pricingTable[planType]?.[planFrequency]?.[paymentMethod] || 0;
      setValue('monthly_fee', fee);
    } else {
      setValue('monthly_fee', 0);
    }
  }, [planType, planFrequency, paymentMethod, setValue]);

  const { data: students, isLoading } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });

  const mutation = useMutation({
    mutationFn: async (formData: StudentFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");
      
      const dataToSubmit = { ...formData };
      if (dataToSubmit.plan_type === 'Avulso') {
        dataToSubmit.plan_frequency = undefined;
        dataToSubmit.payment_method = undefined;
        dataToSubmit.monthly_fee = 0;
      }

      if (selectedStudent) {
        const { error } = await supabase.from("students").update(dataToSubmit).eq("id", selectedStudent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert([{ ...dataToSubmit, user_id: user.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      showSuccess(`Aluno ${selectedStudent ? "atualizado" : "adicionado"} com sucesso!`);
      setFormOpen(false);
      setSelectedStudent(null);
      reset();
    },
    onError: (error) => { showError(error.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase.from("students").delete().eq("id", studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      showSuccess("Aluno removido com sucesso!");
      setDeleteAlertOpen(false);
      setSelectedStudent(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const handleAddNew = () => {
    setSelectedStudent(null);
    reset({ name: "", email: "", phone: "", status: "Experimental", notes: "", plan_type: "Avulso" });
    setFormOpen(true);
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    reset(student);
    setFormOpen(true);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setDeleteAlertOpen(true);
  };

  const onSubmit = (data: StudentFormData) => { mutation.mutate(data); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Gestão de Alunos</h1>
        <Button onClick={handleAddNew}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Aluno</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : students && students.length > 0 ? (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium"><Link to={`/alunos/${student.id}`} className="hover:underline">{student.name}</Link></TableCell>
                  <TableCell>{student.plan_type !== 'Avulso' ? `${student.plan_type} ${student.plan_frequency}` : 'Avulso'}</TableCell>
                  <TableCell>{student.status}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(student)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(student)}>Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <UserX className="w-12 h-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">Nenhum aluno encontrado</h3><p className="mt-1 text-sm text-muted-foreground">Comece adicionando o primeiro aluno.</p>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{selectedStudent ? "Editar Aluno" : "Adicionar Novo Aluno"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Nome</Label><Controller name="name" control={control} render={({ field, fieldState }) => (<><Input {...field} />{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Controller name="email" control={control} render={({ field, fieldState }) => (<><Input {...field} />{fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}</>)} /></div>
                <div className="space-y-2"><Label>Telefone</Label><Controller name="phone" control={control} render={({ field }) => <Input {...field} />} /></div>
              </div>
              <div className="space-y-2"><Label>Status</Label><Controller name="status" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem><SelectItem value="Experimental">Experimental</SelectItem><SelectItem value="Bloqueado">Bloqueado</SelectItem></SelectContent></Select>)} /></div>
              <div className="space-y-2"><Label>Plano</Label><Controller name="plan_type" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Avulso">Avulso</SelectItem><SelectItem value="Mensal">Mensal</SelectItem><SelectItem value="Trimestral">Trimestral</SelectItem></SelectContent></Select>)} /></div>
              {planType !== 'Avulso' && (
                <div className="grid grid-cols-2 gap-4 p-4 border bg-muted/50 rounded-lg">
                  <div className="space-y-2"><Label>Frequência</Label><Controller name="plan_frequency" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2x">2x na semana</SelectItem><SelectItem value="3x">3x na semana</SelectItem><SelectItem value="4x">4x na semana</SelectItem><SelectItem value="5x">5x na semana</SelectItem></SelectContent></Select>)} /></div>
                  <div className="space-y-2"><Label>Pagamento</Label><Controller name="payment_method" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cartão">Cartão</SelectItem><SelectItem value="Espécie">Espécie</SelectItem></SelectContent></Select>)} /></div>
                  <div className="col-span-2 text-center pt-2">
                    <p className="text-sm text-muted-foreground">Valor da Mensalidade:</p>
                    <p className="text-xl font-bold">R$ {watch('monthly_fee')?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              )}
              <div className="space-y-2"><Label>Notas</Label><Controller name="notes" control={control} render={({ field }) => <Textarea {...field} />} /></div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Essa ação não pode ser desfeita. Isso irá remover permanentemente o aluno "{selectedStudent?.name}" do banco de dados.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => selectedStudent && deleteMutation.mutate(selectedStudent.id)} disabled={deleteMutation.isPending} className="bg-destructive hover:bg-destructive/90">{deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sim, excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Students;