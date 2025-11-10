import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Student, StudentStatus, PlanType, EnrollmentType } from "@/types/student";
import { showError, showSuccess } from "@/utils/toast";
import { useSearchParams } from "react-router-dom";

// Importar os novos componentes modulares
import StudentsHeader from '@/components/students/StudentsHeader';
import StudentsTable from '@/components/students/StudentsTable';
import AddEditStudentDialog from '@/components/students/AddEditStudentDialog';
import DeleteStudentAlertDialog from '@/components/students/DeleteStudentAlertDialog';
import StudentCSVUploader from '@/components/students/StudentCSVUploader';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import StudentStatsCards from '@/components/students/StudentStatsCards';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { addDays, parseISO, isPast } from 'date-fns';

// Moved fetchStudents outside the component
const fetchStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase.from("students").select("*").order("name");
  if (error) throw new Error(error.message);
  return data || [];
};

// Novo fetch para status de pagamento (inadimplência)
const fetchStudentPaymentStatus = async (): Promise<Record<string, 'Em Dia' | 'Atrasado'>> => {
  const now = new Date().toISOString();
  
  // Busca todas as transações de receita pendentes ou atrasadas com data de vencimento no passado
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('student_id, due_date')
    .eq('type', 'revenue')
    .or(`status.eq.Atrasado,and(status.eq.Pendente,due_date.lt.${now})`);

  if (error) throw new Error(error.message);

  const overdueStudents: Record<string, 'Em Dia' | 'Atrasado'> = {};
  
  // Marca todos os alunos que têm pelo menos uma transação atrasada/pendente como 'Atrasado'
  data.forEach(t => {
    if (t.student_id) {
      overdueStudents[t.student_id] = 'Atrasado';
    }
  });

  return overdueStudents;
};

const Students = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [isImportOpen, setImportOpen] = useState(false);
  const [isScheduleOpen, setScheduleOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentToSchedule, setStudentToSchedule] = useState<Student | null>(null);

  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<StudentStatus | 'all'>('all');
  const [filterPlanType, setFilterPlanType] = useState<PlanType | 'all'>('all');
  const [filterEnrollmentType, setFilterEnrollmentType] = useState<EnrollmentType | 'all'>('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'Em Dia' | 'Atrasado'>('all');

  // Read initial filters from query params on mount
  useEffect(() => {
    const status = searchParams.get('status');
    const payment = searchParams.get('payment');
    const plan = searchParams.get('plan');

    if (status && ['Ativo', 'Inativo', 'Experimental', 'Bloqueado'].includes(status)) {
      setFilterStatus(status as StudentStatus);
    }
    if (payment && ['Em Dia', 'Atrasado'].includes(payment)) {
      setFilterPaymentStatus(payment as 'Em Dia' | 'Atrasado');
    }
    if (plan) {
      setFilterPlanType(plan as PlanType | 'all');
    }
  }, [searchParams]);

  const { data: students, isLoading } = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  
  // Nova query para status de pagamento
  const { data: paymentStatusMap, isLoading: isLoadingPaymentStatus } = useQuery({
    queryKey: ["studentPaymentStatus"],
    queryFn: fetchStudentPaymentStatus,
    staleTime: 1000 * 60 * 5,
  });

  const addEditMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");
      
      const dataToSubmit = { ...formData };
      
      const paymentDate = dataToSubmit.payment_date;
      const validityDuration = dataToSubmit.validity_duration;
      
      delete dataToSubmit.payment_date;
      delete dataToSubmit.validity_duration;
      
      const isParticularRecorrente = dataToSubmit.enrollment_type === 'Particular' && dataToSubmit.plan_type !== 'Avulso';

      // Lógica de cálculo da validade e status
      if (isParticularRecorrente && paymentDate && validityDuration) {
        const paymentDateObj = parseISO(paymentDate);
        const validityDate = addDays(paymentDateObj, validityDuration).toISOString();
        dataToSubmit.validity_date = validityDate;
        
        // Se a validade for no futuro, o aluno está Ativo (a menos que seja Bloqueado/Experimental)
        if (!isPast(parseISO(validityDate)) && dataToSubmit.status !== 'Bloqueado' && dataToSubmit.status !== 'Experimental') {
          dataToSubmit.status = 'Ativo';
        } else if (isPast(parseISO(validityDate))) {
          dataToSubmit.status = 'Inativo';
        }
      } else {
        // Para Avulso, Wellhub, TotalPass ou se faltarem dados, a validade é nula
        dataToSubmit.validity_date = null;
      }
      
      // Limpeza de campos opcionais/condicionais
      if (dataToSubmit.plan_type === 'Avulso') {
        dataToSubmit.plan_frequency = null;
        dataToSubmit.payment_method = null;
        dataToSubmit.monthly_fee = 0;
        dataToSubmit.preferred_days = null;
        dataToSubmit.preferred_time = null;
      }
      
      if (!dataToSubmit.has_promotional_value) {
        dataToSubmit.discount_description = null;
      }
      delete dataToSubmit.has_promotional_value;

      // Limpeza de strings vazias para NULL no banco de dados
      if (dataToSubmit.date_of_birth === "") {
        dataToSubmit.date_of_birth = null;
      }
      if (dataToSubmit.email === "") {
        dataToSubmit.email = null;
      }
      if (dataToSubmit.phone === "") {
        dataToSubmit.phone = null;
      }
      if (dataToSubmit.address === "") {
        dataToSubmit.address = null;
      }
      if (dataToSubmit.guardian_phone === "") {
        dataToSubmit.guardian_phone = null;
      }
      if (dataToSubmit.notes === "") {
        dataToSubmit.notes = null;
      }
      
      let studentId = selectedStudent?.id;
      
      if (selectedStudent) {
        // Atualiza aluno existente
        const { error } = await supabase.from("students").update(dataToSubmit).eq("id", selectedStudent.id);
        if (error) throw error;
      } else {
        // Insere novo aluno
        const { data: newStudent, error } = await supabase.from("students").insert([{ ...dataToSubmit, user_id: user.id }]).select('id').single();
        if (error) throw error;
        studentId = newStudent.id;
      }
      
      // 2. Registrar Transação (Apenas se for novo aluno e tiver valor)
      if (!selectedStudent && studentId && dataToSubmit.monthly_fee > 0 && isParticularRecorrente) {
        const transaction = {
          user_id: user.id,
          student_id: studentId,
          description: `Mensalidade - ${dataToSubmit.plan_type} ${dataToSubmit.plan_frequency || ''}`,
          category: 'Mensalidade',
          amount: dataToSubmit.monthly_fee,
          type: 'revenue',
          status: 'Pago',
          due_date: dataToSubmit.validity_date, // Próximo vencimento
          paid_at: paymentDate, // Data de pagamento é a data informada
        };
        
        const { error: transactionError } = await supabase.from('financial_transactions').insert([transaction]);
        if (transactionError) throw transactionError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      queryClient.invalidateQueries({ queryKey: ["studentPaymentStatus"] });
      queryClient.invalidateQueries({ queryKey: ["studentStats"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ['birthdayStudents'] });
      showSuccess(`Aluno ${selectedStudent ? "atualizado" : "adicionado"} com sucesso!`);
      setFormOpen(false);
      setSelectedStudent(null);
    },
    onError: (error) => { showError(error.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase.rpc('delete_student', {
        student_id_to_delete: studentId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      queryClient.invalidateQueries({ queryKey: ["studentPaymentStatus"] });
      queryClient.invalidateQueries({ queryKey: ["studentStats"] });
      queryClient.invalidateQueries({ queryKey: ['birthdayStudents'] });
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
  
  const handleScheduleClass = useCallback((student: Student) => {
    setStudentToSchedule(student);
    setScheduleOpen(true);
  }, []);

  const onSubmitStudent = useCallback((data: any) => {
    addEditMutation.mutate(data);
  }, [addEditMutation]);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    
    const term = searchTerm.toLowerCase().trim();
    
    return students.filter(student => {
      // 1. Filtro de Busca por Termo
      const matchesSearchTerm = term === '' ||
        student.name.toLowerCase().includes(term) ||
        (student.email && student.email.toLowerCase().includes(term)) ||
        (student.phone && student.phone.toLowerCase().includes(term));
        
      // 2. Filtro de Status do Aluno
      const matchesStatus = filterStatus === 'all' || student.status === filterStatus;
      
      // 3. Filtro de Tipo de Plano
      const matchesPlanType = filterPlanType === 'all' || student.plan_type === filterPlanType;
      
      // 4. Filtro de Tipo de Matrícula
      const matchesEnrollmentType = filterEnrollmentType === 'all' || student.enrollment_type === filterEnrollmentType;
      
      // 5. Novo Filtro de Status de Pagamento
      const studentPaymentStatus = paymentStatusMap?.[student.id] || 'Em Dia';
      const matchesPaymentStatus = filterPaymentStatus === 'all' || studentPaymentStatus === filterPaymentStatus;
      
      return matchesSearchTerm && matchesStatus && matchesPlanType && matchesEnrollmentType && matchesPaymentStatus;
    });
  }, [students, searchTerm, filterStatus, filterPlanType, filterEnrollmentType, filterPaymentStatus, paymentStatusMap]);

  return (
    <div className="space-y-8">
      <StudentsHeader
        studentCount={filteredStudents?.length}
        onAddNewStudent={handleAddNew}
        onImportCSV={() => setImportOpen(true)}
      />
      
      <StudentStatsCards />

      <Card className="p-4 shadow-impressionist shadow-subtle-glow">
        <div className="flex items-center mb-4">
          <Search className="w-5 h-5 mr-2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Select value={filterStatus} onValueChange={(value: StudentStatus | 'all') => setFilterStatus(value)}>
            <SelectTrigger><SelectValue placeholder="Status do Aluno" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
              <SelectItem value="Experimental">Experimental</SelectItem>
              <SelectItem value="Bloqueado">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterPlanType} onValueChange={(value: PlanType | 'all') => setFilterPlanType(value)} disabled={isLoadingSettings}>
            <SelectTrigger><SelectValue placeholder="Tipo de Plano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Planos</SelectItem>
              {appSettings?.plan_types.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={filterEnrollmentType} onValueChange={(value: EnrollmentType | 'all') => setFilterEnrollmentType(value)} disabled={isLoadingSettings}>
            <SelectTrigger><SelectValue placeholder="Tipo de Matrícula" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos de Matrícula</SelectItem>
              {appSettings?.enrollment_types.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={filterPaymentStatus} onValueChange={(value: 'all' | 'Em Dia' | 'Atrasado') => setFilterPaymentStatus(value)} disabled={isLoadingPaymentStatus}>
            <SelectTrigger><SelectValue placeholder="Status de Pagamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Pagamentos</SelectItem>
              <SelectItem value="Em Dia">Em Dia</SelectItem>
              <SelectItem value="Atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <StudentsTable
        students={filteredStudents}
        isLoading={isLoading || isLoadingSettings || isLoadingPaymentStatus}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onScheduleClass={handleScheduleClass}
        paymentStatusMap={paymentStatusMap}
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

      <StudentCSVUploader
        isOpen={isImportOpen}
        onOpenChange={setImportOpen}
      />
      
      <AddClassDialog 
        isOpen={isScheduleOpen} 
        onOpenChange={setScheduleOpen} 
        preSelectedStudentId={studentToSchedule?.id}
      />
    </div>
  );
};

export default Students;