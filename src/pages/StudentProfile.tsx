import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/student';
import { FinancialTransaction } from '@/types/financial';
import { Loader2, ArrowLeft, User, Mail, Phone, StickyNote, DollarSign, Calendar, Calculator, MoreHorizontal, CheckCircle, Cake, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import ProRataCalculator from '../components/students/ProRataCalculator';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import { showError, showSuccess } from '@/utils/toast';
import ColoredSeparator from "@/components/ColoredSeparator";
import { useSession } from '@/contexts/SessionProvider';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import FinancialTableSkeleton from '@/components/financial/FinancialTableSkeleton'; // Reutilizando o skeleton de tabela
import { formatCurrency } from "@/utils/formatters"; // Importar do utilitário

type ClassAttendance = {
  id: string;
  status: string;
  classes: {
    title: string;
    start_time: string;
  };
};

type StudentProfileData = {
  student: Student;
  transactions: FinancialTransaction[];
  attendance: ClassAttendance[];
};

const fetchStudentProfile = async (studentId: string): Promise<StudentProfileData> => {
  // Executa todas as consultas em paralelo usando Promise.all
  const [
    { data: student, error: studentError },
    { data: transactions, error: transactionsError },
    { data: attendance, error: attendanceError },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single(),
    supabase
      .from('financial_transactions')
      .select('*, students(name)') // Inclui students(name) para consistência, embora já tenhamos o aluno principal
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
    supabase
      .from('class_attendees')
      .select('id, status, classes(title, start_time)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
  ]);

  if (studentError) throw new Error(`Erro ao carregar dados do aluno: ${studentError.message}`);
  if (transactionsError) throw new Error(`Erro ao carregar transações: ${transactionsError.message}`);
  if (attendanceError) throw new Error(`Erro ao carregar presença: ${attendanceError.message}`);

  return { 
    student: student!, 
    transactions: transactions || [], 
    attendance: (attendance as any) || [] 
  };
};

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const queryClient = useQueryClient();
  const [isProRataOpen, setProRataOpen] = useState(false);
  const [isAddClassOpen, setAddClassOpen] = useState(false);
  const { profile } = useSession();
  const isAdmin = profile?.role === 'admin';

  const { data, isLoading, error } = useQuery({
    queryKey: ['studentProfile', studentId],
    queryFn: () => fetchStudentProfile(studentId!),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2, // Cache por 2 minutos
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      if (!isAdmin) {
        throw new Error("Você não tem permissão para marcar transações como pagas.");
      }
      const { error } = await supabase
        .from('financial_transactions')
        .update({ status: 'Pago', paid_at: new Date().toISOString() })
        .eq('id', transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentProfile', studentId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialStats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      showSuccess('Transação marcada como paga com sucesso!');
    },
    onError: (error) => { showError(error.message); },
  });

  if (error) {
    return <div className="text-center text-destructive">Erro ao carregar o perfil do aluno: {error.message}</div>;
  }

  const student = data?.student;
  const transactions = data?.transactions || [];
  const attendance = data?.attendance || [];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" className="mb-4">
          <Link to="/alunos">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Alunos
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-muted rounded-full">
              {isLoading ? <Skeleton className="w-8 h-8 rounded-full" /> : <User className="w-8 h-8 text-muted-foreground" />}
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                {isLoading ? <Skeleton className="h-8 w-48" /> : student?.name}
              </h1>
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </>
                ) : (
                  <>
                    <Badge variant={
                      student?.status === 'Ativo' ? 'status-active' :
                      student?.status === 'Inativo' ? 'status-inactive' :
                      student?.status === 'Experimental' ? 'status-experimental' :
                      'status-blocked'
                    }>{student?.status}</Badge>
                    <Badge variant="secondary">{student?.enrollment_type}</Badge>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {isLoading ? (
              <>
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-10 w-36" />
              </>
            ) : (
              <>
                {student?.plan_type !== 'Avulso' && (
                  <Button onClick={() => setProRataOpen(true)}>
                    <Calculator className="w-4 h-4 mr-2" />
                    Gerar 1ª Cobrança
                  </Button>
                )}
                <Button onClick={() => setAddClassOpen(true)}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Agendar Aula
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ColoredSeparator color="primary" className="my-6" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card variant="bordered" className="lg:col-span-1 shadow-impressionist shadow-subtle-glow">
          <CardHeader>
            <CardTitle className="flex items-center"><StickyNote className="w-5 h-5 mr-2" /> Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-3 text-muted-foreground" />
                  <span>{student?.email || 'Não informado'}</span>
                </div>
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-3 text-muted-foreground" />
                  <span>{student?.phone || 'Não informado'}</span>
                </div>
                {student?.date_of_birth && (
                  <div className="flex items-center">
                    <Cake className="w-4 h-4 mr-3 text-muted-foreground" />
                    <span>{format(parseISO(student.date_of_birth), 'dd/MM/yyyy')}</span>
                  </div>
                )}
                {student?.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground">{student.notes}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card variant="bordered-green" className="lg:col-span-2 shadow-impressionist shadow-subtle-glow">
          <CardHeader>
            <CardTitle className="flex items-center"><DollarSign className="w-5 h-5 mr-2" /> Histórico Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <FinancialTableSkeleton columns={5} rows={3} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length > 0 ? transactions.map(t => (
                    <TableRow 
                      key={t.id} 
                      className={cn(
                        "hover:bg-muted/50 transition-colors",
                        t.status === 'Pago' && "bg-green-50/5",
                        t.status === 'Atrasado' && "bg-red-50/5",
                        t.status === 'Pendente' && "bg-yellow-50/5"
                      )}
                    >
                      <TableCell>{t.description}</TableCell>
                      <TableCell>
                        <Badge variant={
                          t.status === 'Pago' ? 'payment-paid' :
                          t.status === 'Atrasado' ? 'payment-overdue' :
                          'payment-pending'
                        }>{t.status}</Badge>
                      </TableCell>
                      <TableCell>{t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(t.amount)}</TableCell>
                      <TableCell className="text-right">
                        {t.status !== 'Pago' && t.type === 'revenue' && isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => markAsPaidMutation.mutate(t.id)}>
                                <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Pago
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="text-center">Nenhum lançamento financeiro.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card variant="bordered-yellow" className="lg:col-span-3 shadow-impressionist shadow-subtle-glow">
          <CardHeader>
            <CardTitle className="flex items-center"><Calendar className="w-5 h-5 mr-2" /> Histórico de Presença</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <FinancialTableSkeleton columns={3} rows={3} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aula</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.length > 0 ? attendance.map(a => (
                    <TableRow 
                      key={a.id} 
                      className={cn(
                        "hover:bg-muted/50 transition-colors",
                        a.status === 'Presente' && "bg-green-50/5",
                        a.status === 'Faltou' && "bg-red-50/5",
                        a.status === 'Agendado' && "bg-blue-50/5"
                      )}
                    >
                      <TableCell>{a.classes.title}</TableCell>
                      <TableCell>{format(parseISO(a.classes.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell>
                        <Badge variant={
                          a.status === 'Presente' ? 'attendance-present' :
                          a.status === 'Faltou' ? 'attendance-absent' :
                          'attendance-scheduled'
                        }>{a.status}</Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="text-center">Nenhum registro de presença.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      {student && <ProRataCalculator isOpen={isProRataOpen} onOpenChange={setProRataOpen} student={student} />}
      {student && <AddClassDialog isOpen={isAddClassOpen} onOpenChange={setAddClassOpen} />}
    </div>
  );
};

export default StudentProfile;