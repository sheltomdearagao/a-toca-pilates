import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
});

type StudentFormData = z.infer<typeof studentSchema>;

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

  const { data: students, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
  });

  const { control, handleSubmit, reset, setValue } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      status: "Experimental",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (formData: StudentFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const dataToSubmit = {
        ...formData,
        email: formData.email || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
      };

      if (selectedStudent) {
        // Update
        const { error } = await supabase
          .from("students")
          .update(dataToSubmit)
          .eq("id", selectedStudent.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from("students")
          .insert([{ ...dataToSubmit, user_id: user.id }]);
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
    onError: (error) => {
      showError(error.message);
    },
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
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleAddNew = () => {
    setSelectedStudent(null);
    reset({ name: "", email: "", phone: "", status: "Experimental", notes: "" });
    setFormOpen(true);
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setValue("name", student.name);
    setValue("email", student.email || "");
    setValue("phone", student.phone || "");
    setValue("status", student.status);
    setValue("notes", student.notes || "");
    setFormOpen(true);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setDeleteAlertOpen(true);
  };

  const onSubmit = (data: StudentFormData) => {
    mutation.mutate(data);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Gestão de Alunos</h1>
        <Button onClick={handleAddNew}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Adicionar Aluno
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : students && students.length > 0 ? (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    <Link to={`/alunos/${student.id}`} className="hover:underline">
                      {student.name}
                    </Link>
                  </TableCell>
                  <TableCell>{student.email || "-"}</TableCell>
                  <TableCell>{student.phone || "-"}</TableCell>
                  <TableCell>{student.status}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
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
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <UserX className="w-12 h-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Nenhum aluno encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece adicionando o primeiro aluno.
          </p>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedStudent ? "Editar Aluno" : "Adicionar Novo Aluno"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Nome</Label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <div className="col-span-3">
                      <Input id="name" {...field} />
                      {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                    </div>
                  )}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Email</Label>
                <Controller
                  name="email"
                  control={control}
                  render={({ field, fieldState }) => (
                    <div className="col-span-3">
                      <Input id="email" {...field} />
                      {fieldState.error && <p className="text-sm text-destructive mt-1">{fieldState.error.message}</p>}
                    </div>
                  )}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Telefone</Label>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => <Input id="phone" className="col-span-3" {...field} />}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                        <SelectItem value="Experimental">Experimental</SelectItem>
                        <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">Notas</Label>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => <Textarea id="notes" className="col-span-3" {...field} />}
                />
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

      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso irá remover permanentemente o aluno
              "{selectedStudent?.name}" do banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedStudent && deleteMutation.mutate(selectedStudent.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
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