import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Student } from "@/types/student";
import { showError, showSuccess } from "@/utils/toast";

// Importar os novos componentes modulares
import StudentsHeader from '@/components/students/StudentsHeader';
import StudentsTable from '@/components/students/StudentsTable';
import AddEditStudentDialog from '@/components/students/AddEditStudentDialog';
import DeleteStudentAlertDialog from '@/components/students/DeleteStudentAlertDialog';

// Moved fetchStudents outside the component
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

  const { data: students, isLoading } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });

  const addEditMutation = useMutation({
    mutationFn: async (formData: any) => { // Use 'any' for formData here, actual schema is in dialog
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");
      
      const dataToSubmit = { ...formData };
      if (dataToSubmit.plan_type === 'Avulso') {
        dataToSubmit.plan_frequency = null; // Set to null for Supabase
        dataToSubmit.payment_method = null; // Set to null for Supabase
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
    setFormOpen(true);
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setFormOpen(true);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setDeleteAlertOpen(true);
  };

  const onSubmitStudent = (data: any) => { // Use 'any' here, actual schema is in dialog
    addEditMutation.mutate(data);
  };

  return (
    <div className="space-y-8">
      <StudentsHeader studentCount={students?.length} onAddNewStudent={handleAddNew} />

      <StudentsTable
        students={students}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <AddEditStudentDialog
        isOpen={isFormOpen}
        onOpenChange={setFormOpen}
        selectedStudent={selectedStudent}
        onSubmit={onSubmitStudent}
        isSubmitting={addEditMutation.isPending}
      />

      <DeleteStudentAlertDialog
        isOpen={isDeleteAlertOpen}
        onOpenChange={setDeleteAlertOpen}
        selectedStudentName={selectedStudent?.name}
        onConfirmDelete={() => selectedStudent && deleteMutation.mutate(selectedStudent.id)}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
};

export default Students;