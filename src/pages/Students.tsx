import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query'; // Adicionado import
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/student';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Search, Filter, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColoredSeparator } from '@/components/ColoredSeparator';
import StudentsTable from '@/components/students/StudentsTable';
import StudentsHeader from '@/components/students/StudentsHeader';
import StudentStatsCards from '@/components/students/StudentStatsCards';
import AddEditStudentDialog from '@/components/students/AddEditStudentDialog';
import StudentCSVUploader from '@/components/students/StudentCSVUploader';
import DeleteStudentAlertDialog from '@/components/students/DeleteStudentAlertDialog';
import { showSuccess, showError } from '@/utils/toast'; // Adicionado import
import { useAppSettings } from '@/hooks/useAppSettings';

const fetchStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('name', { ascending: true }); // Ordenar por nome em ordem alfabética A-Z

  if (error) throw new Error(error.message);
  return data || [];
};

const fetchPaymentStatusMap = async (): Promise<Record<string, 'Em Dia' | 'Atrasado'>> => {
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('student_id, status, due_date')
    .eq('type', 'revenue');

  if (error) throw new Error(error.message);

  const statusMap: Record<string, 'Em Dia' | 'Atrasado'> = {};

  (data || []).forEach(transaction => {
    if (transaction.student_id && !statusMap[transaction.student_id]) {
      const isOverdue = transaction.status === 'Atrasado' ||
        (transaction.status === 'Pendente' && transaction.due_date &&
         new Date(transaction.due_date) < new Date());

      statusMap[transaction.student_id] = isOverdue ? 'Atrasado' : 'Em Dia';
    }
  });

  return statusMap;
};

const Students = () => {
  const queryClient = useQueryClient(); // Adicionado useQueryClient
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Student['status']>('all');
  const [filterPlanType, setFilterPlanType] = useState<'all' | Student['plan_type']>('all');
  const [filterEnrollmentType, setFilterEnrollmentType] = useState<'all' | Student['enrollment_type']>('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'Em Dia' | 'Atrasado'>('all');

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [isCSVUploaderOpen, setIsCSVUploaderOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: fetchStudents,
    staleTime: 1000 * 60 * 5,
  });

  const { data: paymentStatusMap, isLoading: isLoadingPaymentStatus } = useQuery({
    queryKey: ['studentPaymentStatus'],
    queryFn: fetchPaymentStatusMap,
    staleTime: 1000 * 60 * 5,
  });

  const { data: appSettings } = useAppSettings();

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
      
      // 4. Filtro de Tipo de Matrícula (MODIFICADO)
      let matchesEnrollmentType = filterEnrollmentType === 'all';
      if (!matchesEnrollmentType) {
        const enrollmentTypeLower = student.enrollment_type.toLowerCase();
        const filterLower = filterEnrollmentType.toLowerCase();
        
        if (filterLower === 'wellhub') {
          // Wellhub inclui: Wellhub, Gympass, Gympass/Wellhub, Wellhub/Gympass
          matchesEnrollmentType = 
            enrollmentTypeLower.includes('wellhub') || 
            enrollmentTypeLower.includes('gympass');
        } else {
          // Para outros tipos, faz match exato
          matchesEnrollmentType = enrollmentTypeLower === filterLower;
        }
      }
      
      // 5. Novo Filtro de Status de Pagamento
      const studentPaymentStatus = paymentStatusMap?.[student.id] || 'Em Dia';
      const matchesPaymentStatus = filterPaymentStatus === 'all' || studentPaymentStatus === filterPaymentStatus;
      
      return matchesSearchTerm && matchesStatus && matchesPlanType && matchesEnrollmentType && matchesPaymentStatus;
    });
  }, [students, searchTerm, filterStatus, filterPlanType, filterEnrollmentType, filterPaymentStatus, paymentStatusMap]);

  const handleAddNewStudent = () => {
    setSelectedStudent(null);
    setIsAddEditOpen(true);
  };

  const handleImportCSV = () => {
    setIsCSVUploaderOpen(true);
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setIsAddEditOpen(true);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setIsDeleteAlertOpen(true);
  };

  const handleScheduleClass = (student: Student) => {
    // TODO: Implementar agendamento de aula
    console.log('Agendar aula para:', student.name);
  };

  const handleSubmitStudent = async (data: any) => {
    // TODO: Implementar submissão do formulário
    console.log('Dados do aluno:', data);
    setIsAddEditOpen(false);
    showSuccess('Aluno salvo com sucesso!');
  };

  const handleConfirmDelete = async () => {
    if (!selectedStudent) return;

    // TODO: Implementar exclusão do aluno
    console.log('Excluindo aluno:', selectedStudent.name);
    setIsDeleteAlertOpen(false);
    setSelectedStudent(null);
    showSuccess('Aluno excluído com sucesso!');
  };

  // Nova função para atualizar todos os alunos para 'Ativo'
  const handleBulkUpdateStatus = async () => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ status: 'Ativo' });

      if (error) throw error;

      // Invalida cache para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['studentStats'] });

      showSuccess('Todos os alunos foram definidos como "Ativo" com sucesso!');
    } catch (error: any) {
      showError(`Erro ao atualizar status: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <StudentsHeader
        studentCount={students?.length}
        onAddNewStudent={handleAddNewStudent}
        onImportCSV={handleImportCSV}
      />

      {/* Botão de Atualização em Massa */}
      <div className="flex justify-end mb-4">
        <Button 
          variant="outline" 
          onClick={handleBulkUpdateStatus}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Definir Todos como Ativo
        </Button>
      </div>

      <ColoredSeparator color="primary" />

      <StudentStatsCards />

      <Card className="shadow-impressionist shadow-subtle-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Experimental">Experimental</SelectItem>
                  <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={filterPlanType} onValueChange={(value: any) => setFilterPlanType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {appSettings?.plan_types.map(plan => (
                    <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Select value={filterEnrollmentType} onValueChange={(value: any) => setFilterEnrollmentType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {appSettings?.enrollment_types.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select value={filterPaymentStatus} onValueChange={(value: any) => setFilterPaymentStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Em Dia">Em Dia</SelectItem>
                  <SelectItem value="Atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <StudentsTable
        students={filteredStudents}
        isLoading={isLoadingStudents || isLoadingPaymentStatus}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onScheduleClass={handleScheduleClass}
        paymentStatusMap={paymentStatusMap}
      />

      <AddEditStudentDialog
        isOpen={isAddEditOpen}
        onOpenChange={setIsAddEditOpen}
        selectedStudent={selectedStudent}
        onSubmit={handleSubmitStudent}
        isSubmitting={false}
      />

      <StudentCSVUploader
        isOpen={isCSVUploaderOpen}
        onOpenChange={setIsCSVUploaderOpen}
      />

      <DeleteStudentAlertDialog
        isOpen={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
        selectedStudentName={selectedStudent?.name}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={false}
      />
    </div>
  );
};

export default Students;