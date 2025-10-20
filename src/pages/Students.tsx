import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Student, StudentStatus, PlanType, EnrollmentType } from "@/types/student";
import { showError, showSuccess } from "@/utils/toast";

// Importar os novos componentes modulares
import StudentsHeader from '@/components/students/StudentsHeader';
import StudentsTable from '@/components/students/StudentsTable';
import AddEditStudentDialog from '@/components/students/AddEditStudentDialog';
import DeleteStudentAlertDialog from '@/components/students/DeleteStudentAlertDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppSettings } from '@/hooks/useAppSettings'; // Importar o hook de configurações

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

  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<StudentStatus | 'all'>('all');
  const [filterPlanType, setFilterPlanType] = useState<PlanType | 'all'>('all');
  const [filterEnrollmentType, setFilterEnrollmentType] = useState<EnrollmentType | 'all'>('all');

  const { data: students, isLoading } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();

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

  const handleAddNew = useCallback(() => {
    setSelectedStudent(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((student: Student) => {
    setSelectedStudent(student);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((student: Student) => {
    setSelectedStudent(student);
    setDeleteAlertOpen(true);
  }, []);

  const onSubmitStudent = useCallback((data: any) => { // Use 'any' here, actual schema is in dialog
    addEditMutation.mutate(data);
  }, [addEditMutation]);

  // Lógica de filtragem combinada
  const filteredStudents = useMemo(() => {
    if (!students) return [];

    return students.filter(student => {
      // Filtro por termo de busca (nome, email, telefone)
      const matchesSearchTerm = searchTerm.trim() === '' ||
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.email && student.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (student.phone && student.phone.toLowerCase().includes(searchTerm.toLowerCase()));

      // Filtro por status
      const matchesStatus = filterStatus === 'all' || student.status === filterStatus;

      // Filtro por tipo de plano
      const matchesPlanType = filterPlanType === 'all' || student.plan_type === filterPlanType;

      // Filtro por tipo de matrícula
      const matchesEnrollmentType = filterEnrollmentType === 'all' || student.enrollment_type === filterEnrollmentType;

      return matchesSearchTerm && matchesStatus && matchesPlanType && matchesEnrollmentType;
    });
  }, [students, searchTerm, filterStatus, filterPlanType, filterEnrollmentType]);

  return (
    <div className="space-y-8">
      <StudentsHeader studentCount={filteredStudents?.length} onAddNewStudent={handleAddNew} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="col-span-full lg:col-span-1"
        />

        <Select value={filterStatus} onValueChange={(value: StudentStatus | 'all') => setFilterStatus(value)}>
          <SelectTrigger><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
            <SelectItem value="Experimental">Experimental</SelectItem>
            <SelectItem value="Bloqueado">Bloqueado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPlanType} onValueChange={(value: PlanType | 'all') => setFilterPlanType(value)} disabled={isLoadingSettings}>
          <SelectTrigger><SelectValue placeholder="Filtrar por Plano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Planos</SelectItem>
            {appSettings?.plan_types.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterEnrollmentType} onValueChange={(value: EnrollmentType | 'all') => setFilterEnrollmentType(value)} disabled={isLoadingSettings}>
          <SelectTrigger><SelectValue placeholder="Filtrar por Matrícula" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos de Matrícula</SelectItem>
            {appSettings?.enrollment_types.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <StudentsTable
        students={filteredStudents}
        isLoading={isLoading || isLoadingSettings}
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