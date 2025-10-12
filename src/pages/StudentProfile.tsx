import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/student';
import { FinancialTransaction } from '@/types/financial';
import { Loader2, ArrowLeft, User, Mail, Phone, StickyNote, DollarSign, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();
  if (studentError) throw new Error(studentError.message);

  const { data: transactions, error: transactionsError } = await supabase
    .from('financial_transactions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (transactionsError) throw new Error(transactionsError.message);

  const { data: attendance, error: attendanceError } = await supabase
    .from('class_attendees')
    .select('id, status, classes(title, start_time)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (attendanceError) throw new Error(attendanceError.message);

  return { student, transactions: transactions || [], attendance: (attendance as any) || [] };
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['studentProfile', studentId],
    queryFn: () => fetchStudentProfile(studentId!),
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-destructive">Erro ao carregar o perfil do aluno: {error.message}</div>;
  }

  const { student, transactions, attendance } = data!;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" className="mb-4">
          <Link to="/alunos">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Alunos
          </Link>
        </Button>
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-muted rounded-full">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <Badge>{student.status}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center"><StickyNote className="w-5 h-5 mr-2" /> Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center">
              <Mail className="w-4 h-4 mr-3 text-muted-foreground" />
              <span>{student.email || 'Não informado'}</span>
            </div>
            <div className="flex items-center">
              <Phone className="w-4 h-4 mr-3 text-muted-foreground" />
              <span>{student.phone || 'Não informado'}</span>
            </div>
            {student.notes && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground">{student.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center"><DollarSign className="w-5 h-5 mr-2" /> Histórico Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? transactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{t.description}</TableCell>
                    <TableCell><Badge variant={t.status === 'Pago' ? 'default' : t.status === 'Atrasado' ? 'destructive' : 'secondary'}>{t.status}</Badge></TableCell>
                    <TableCell>{t.due_date ? format(parseISO(t.due_date), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(t.amount)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={4} className="text-center">Nenhum lançamento financeiro.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center"><Calendar className="w-5 h-5 mr-2" /> Histórico de Presença</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <TableRow key={a.id}>
                    <TableCell>{a.classes.title}</TableCell>
                    <TableCell>{format(parseISO(a.classes.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell><Badge variant={a.status === 'Presente' ? 'default' : a.status === 'Faltou' ? 'destructive' : 'secondary'}>{a.status}</Badge></TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={3} className="text-center">Nenhum registro de presença.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentProfile;