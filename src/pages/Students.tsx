import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Student, PlanType, PlanFrequency, PaymentMethod, EnrollmentType } from "@/types/student";
import { Button, buttonVariants } from "@/components/ui/button"; // Importar buttonVariants
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
import { Loader2, MoreHorizontal, PlusCircle, UserX, Users } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { showError, showSuccess } from "@/utils/toast";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useAppSettings } from '@/hooks/useAppSettings';
import ColoredSeparator from "@/components/ColoredSeparator";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();

  const dynamicPlanTypeSchema = z.enum(appSettings?.plan_types as [string, ...string[]] || ["Avulso"]);
  const dynamicPlanFrequencySchema = z.enum(appSettings?.plan_frequencies as [string, ...string[]] || ["2x"]).optional();
  const dynamicPaymentMethodSchema = z.enum(appSettings?.payment_methods as [string, ...string[]] || ["Cartão"]).optional();
  const dynamicEnrollmentTypeSchema = z.enum(appSettings?.enrollment_types as [string, ...string[]] || ["Particular"]);

  const dynamicStudentSchema = z.object({
    name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
    email: z.string().email("Email inválido.").optional().or(z.literal("")),
    phone: z.string().optional(),
    status: z.enum(["Ativo", "Inativo", "Experimental", "Bloqueado"]),
    notes: z.string().optional(),
    plan_type: dynamicPlanTypeSchema.default("Avulso"),
    plan_frequency: dynamicPlanFrequencySchema,
    payment_method: dynamicPaymentMethodSchema,
    monthly_fee: z.number().optional(),
    enrollment_type: dynamicEnrollmentTypeSchema.default("Particular"),
    date_of_birth: z.string().optional().nullable(),
  }).superRefine((data, ctx) => {
    if (data.plan_type !== 'Avulso') {
      if (!data.plan_frequency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A frequência do plano é obrigatória para planos não avulsos.',
          path: ['plan_frequency'],
        });
      }
      if (!data.payment_method) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'O método de pagamento é obrigatório para planos não avulsos.',
          path: ['payment_method'],
        });
      }
      if (!data.monthly_fee || data.monthly_fee <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'O valor da mensalidade deve ser maior que zero para planos não avulsos.',
          path: ['monthly_fee'],
        });
      }
    }
  });

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<z.infer<typeof dynamicStudentSchema>>({
    resolver: zodResolver(dynamicStudentSchema),
    defaultValues: {
      name: "", email: "", phone: "", status: "Experimental", notes: "",
      plan_type: appSettings?.plan_types?.[0] || "Avulso",
      enrollment_type: appSettings?.enrollment_types?.[0] || "Particular",
      date_of_birth: ""
    },
  });

  const planType = watch("plan_type");
  const planFrequency = watch("plan_frequency");
  const paymentMethod = watch("payment_method");

  useEffect(() => {
    if (planType && planType !== 'Avulso' && planFrequency && paymentMethod) {
      const fee = pricingTable[planType as keyof typeof pricingTable]?.[planFrequency as keyof typeof pricingTable['Mensal']]?.[paymentMethod as keyof typeof pricingTable['Mensal']['2x']] || 0;
      setValue('monthly_fee', fee);
    } else {
      setValue('monthly_fee', 0);
    }
  }, [planType, planFrequency, paymentMethod, setValue]);

  const { data: students, isLoading } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });

  const mutation = useMutation({
    mutationFn: async (formData: z.infer<typeof dynamicStudentSchema>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");
      
      const dataToSubmit = { ...formData };
      if (dataToSubmit.plan_type === 'Avulso') {
        dataToSubmit.plan_frequency = undefined;
        dataToSubmit.payment_method = undefined;
        dataToSubmit.monthly_fee = 0;
      }
      if (dataToSubmit.date_of_birth === "") {
        dataToSubmit.date_of_birth = null;
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
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
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
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      showSuccess("Aluno removido com sucesso!");
      setDeleteAlertOpen(false);
      setSelectedStudent(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const handleAddNew = () => {
    setSelectedStudent(null);
    reset({
      name: "", email: "", phone: "", status: "Experimental", notes: "",
      plan_type: appSettings?.plan_types?.[0] || "Avulso",
      enrollment_type: appSettings?.enrollment_types?.[0] || "Particular",
      date_of_birth: ""
    });
    setFormOpen(true);
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    reset({
      ...student,
      date_of_birth: student.date_of_birth ? format(new Date(student.date_of_birth), 'yyyy-MM-dd') : "",
      plan_type: (student.plan_type as z.infer<typeof dynamicPlanTypeSchema>) || (appSettings?.plan_types?.[0] || "Avulso"),
      plan_frequency: (student.plan_frequency as z.infer<typeof dynamicPlanFrequencySchema>),
      payment_method: (student.payment_method as z.infer<typeof dynamicPaymentMethodSchema>),
      enrollment_type: (student.enrollment_type as z.infer<typeof dynamicEnrollmentTypeSchema>) || (appSettings?.enrollment_types?.[0] || "Particular"),
    });
    setFormOpen(true);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setDeleteAlertOpen(true);
  };

  const onSubmit = (data: z.infer<typeof dynamicStudentSchema>) => { mutation.mutate(data); };

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-primary rounded-xl">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Gestão de Alunos
            </h1>
            <p className="text-muted-foreground">
              {students?.length || 0} alunos cadastrados
            </p>
          </div>
        </div>
        <Button onClick={handleAddNew}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Adicionar Aluno
        </Button>
      </div>

      <ColoredSeparator color="primary" />

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : students && students.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Tipo Matrícula</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow 
                  key={student.id} 
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-medium">
                    <Link 
                      to={`/alunos/${student.id}`} 
                      className="hover:text-primary hover:underline transition-colors flex items-center"
                    >
                      {student.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      (student.plan_type === 'Mensal' ? "bg-primary/10 text-primary" :
                       student.plan_type === 'Trimestral' ? "bg-accent/10 text-accent" :
                       "bg-muted text-muted-foreground")
                    )}>
                      {student.plan_type !== 'Avulso' ? `${student.plan_type} ${student.plan_frequency}` : 'Avulso'}
                    </span>
                  </TableCell>
                  <TableCell>{student.enrollment_type}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      (student.status === 'Ativo' ? "bg-status-active/20 text-status-active" :
                       student.status === 'Inativo' ? "bg-status-inactive/20 text-status-inactive" :
                       student.status === 'Experimental' ? "bg-status-experimental/20 text-status-experimental" :
                       "bg-status-blocked/20 text-status-blocked")
                    )}>
                      {student.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(student)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive" 
                          onClick={() => handleDelete(student)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-primary/50">
          <UserX className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Nenhum aluno encontrado</h3>
          <p className="text-sm text-muted-foreground">Comece adicionando o primeiro aluno.</p>
        </Card>
      )}

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedStudent ? "Editar Aluno" : "Adicionar Novo Aluno"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Controller name="name" control={control} render={({ field, fieldState }) => (
                  <>
                    <Input {...field} />
                    {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                  </>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Controller name="email" control={control} render={({ field, fieldState }) => (
                    <>
                      <Input {...field} />
                      {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                    </>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Controller name="phone" control={control} render={({ field, fieldState }) => (
                    <>
                      <Input {...field} />
                      {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                    </>
                  )} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Controller name="status" control={control} render={({ field, fieldState }) => (
                  <>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                        <SelectItem value="Experimental">Experimental</SelectItem>
                        <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                  </>
                )} />
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Controller name="plan_type" control={control} render={({ field, fieldState }) => (
                  <>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {appSettings?.plan_types.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                  </>
                )} />
              </div>
              {planType !== 'Avulso' && (
                <div className="grid grid-cols-2 gap-4 p-4 border bg-secondary/20 rounded-lg">
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Controller name="plan_frequency" control={control} render={({ field, fieldState }) => (
                      <>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {appSettings?.plan_frequencies.map(freq => (<SelectItem key={freq} value={freq}>{freq} na semana</SelectItem>))}
                          </SelectContent>
                        </Select>
                        {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                      </>
                    )} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pagamento</Label>
                    <Controller name="payment_method" control={control} render={({ field, fieldState }) => (
                      <>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {appSettings?.payment_methods.map(method => (<SelectItem key={method} value={method}>{method}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                      </>
                    )} />
                  </div>
                  <div className="col-span-2 text-center pt-2">
                    <p className="text-sm text-muted-foreground">Valor da Mensalidade:</p>
                    <p className="text-xl font-bold text-primary">R$ {watch('monthly_fee')?.toFixed(2) || '0.00'}</p>
                    {errors.monthly_fee && <p className="text-sm text-destructive mt-1">{errors.monthly_fee.message}</p>}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Tipo de Matrícula</Label>
                <Controller name="enrollment_type" control={control} render={({ field, fieldState }) => (
                  <>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {appSettings?.enrollment_types.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                  </>
                )} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Data de Nascimento</Label>
                <Controller name="date_of_birth" control={control} render={({ field, fieldState }) => (
                  <>
                    <Input id="date_of_birth" type="date" {...field} />
                    {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                  </>
                )} />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Controller name="notes" control={control} render={({ field, fieldState }) => (
                  <>
                    <Textarea {...field} />
                    {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                  </>
                )} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso irá remover permanentemente o aluno "{selectedStudent?.name}" do banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedStudent && deleteMutation.mutate(selectedStudent.id)} 
              disabled={deleteMutation.isPending} 
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Students;