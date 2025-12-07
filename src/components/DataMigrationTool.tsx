import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Loader2, Database, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown } from 'lucide-react'; // Added missing imports

type StudentWithoutBirthday = {
  id: string;
  name: string;
  status: string;
};

type TransactionWithoutDueDate = {
  id: string;
  description: string;
  student_id: string | null;
  students?: { name: string } | null;
};

const fetchStudentsWithoutBirthday = async (): Promise<StudentWithoutBirthday[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, status')
    .eq('status', 'Ativo')
    .is('date_of_birth', null);

  if (error) throw new Error(error.message);
  return data || [];
};

const fetchTransactionsWithoutDueDate = async (): Promise<TransactionWithoutDueDate[]> => {
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('id, description, student_id, students(name)')
    .eq('type', 'revenue')
    .eq('status', 'Pendente')
    .is('due_date', null);

  if (error) throw new Error(error.message);
  return data as unknown as TransactionWithoutDueDate[];
};

const DataMigrationTool = () => {
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // Novo estado para controlar o colapso

  const { data: studentsWithoutBirthday, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['studentsWithoutBirthday'],
    queryFn: fetchStudentsWithoutBirthday,
    staleTime: 1000 * 60 * 2,
  });

  const { data: transactionsWithoutDueDate, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['transactionsWithoutDueDate'],
    queryFn: fetchTransactionsWithoutDueDate,
    staleTime: 1000 * 60 * 2,
  });

  const updateBirthdayMutation = useMutation({
    mutationFn: async ({ studentId, date }: { studentId: string; date: string }) => {
      const { error } = await supabase
        .from('students')
        .update({ date_of_birth: date })
        .eq('id', studentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentsWithoutBirthday'] });
      queryClient.invalidateQueries({ queryKey: ['birthdayStudents'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      showSuccess('Data de nascimento atualizada com sucesso!');
      setIsStudentDialogOpen(false);
      setBirthDate('');
      setSelectedStudentId(null);
    },
    onError: (error: any) => {
      showError(error.message);
    },
  });

  const updateDueDateMutation = useMutation({
    mutationFn: async ({ transactionId, date }: { transactionId: string; date: string }) => {
      const { error } = await supabase
        .from('financial_transactions')
        .update({ due_date: date })
        .eq('id', transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactionsWithoutDueDate'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingPayments'] });
      queryClient.invalidateQueries({ queryKey: ['financialData'] });
      showSuccess('Data de vencimento atualizada com sucesso!');
      setIsTransactionDialogOpen(false);
      setDueDate('');
      setSelectedTransactionId(null);
    },
    onError: (error: any) => {
      showError(error.message);
    },
  });

  const handleOpenStudentDialog = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentDialogOpen(true);
  };

  const handleOpenTransactionDialog = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setIsTransactionDialogOpen(true);
  };

  return (
    <>
      <Card className="shadow-impressionist shadow-subtle-glow border-2 border-yellow-500/50">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center">
            <Database className="w-5 h-5 mr-2 text-yellow-600" />
            <CardTitle className="flex items-center">
              {isCollapsed ? 'Atualização de Dados' : 'Atualização de Dados (Migração de Dados)'}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </CardHeader>
        {!isCollapsed && (
          <CardContent className="space-y-6">
            {/* Alunos sem Data de Nascimento */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-yellow-600" />
                  Alunos sem Data de Nascimento
                </h3>
                <Badge variant="secondary">
                  {isLoadingStudents ? '...' : studentsWithoutBirthday?.length || 0} alunos
                </Badge>
              </div>
              
              {isLoadingStudents ? (
                <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
              ) : studentsWithoutBirthday && studentsWithoutBirthday.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentsWithoutBirthday.map(student => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell><Badge variant="status-active">{student.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleOpenStudentDialog(student.id)}
                            >
                              Adicionar Data
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  ✅ Todos os alunos ativos têm data de nascimento cadastrada!
                </p>
              )}
            </div>

            {/* Transações sem Data de Vencimento */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-yellow-600" />
                  Transações Pendentes sem Data de Vencimento
                </h3>
                <Badge variant="secondary">
                  {isLoadingTransactions ? '...' : transactionsWithoutDueDate?.length || 0} transações
                </Badge>
              </div>
              
              {isLoadingTransactions ? (
                <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
              ) : transactionsWithoutDueDate && transactionsWithoutDueDate.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Aluno</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionsWithoutDueDate.map(transaction => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">{transaction.description}</TableCell>
                          <TableCell>{transaction.students?.name || 'N/A'}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleOpenTransactionDialog(transaction.id)}
                            >
                              Adicionar Vencimento
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  ✅ Todas as transações pendentes têm data de vencimento!
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Dialog para adicionar data de nascimento */}
      <Dialog open={isStudentDialogOpen} onOpenChange={setIsStudentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Data de Nascimento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="birth-date">Data de Nascimento</Label>
              <Input 
                id="birth-date" 
                type="date" 
                value={birthDate} 
                onChange={(e) => setBirthDate(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button 
              onClick={() => selectedStudentId && updateBirthdayMutation.mutate({ studentId: selectedStudentId, date: birthDate })}
              disabled={!birthDate || updateBirthdayMutation.isPending}
            >
              {updateBirthdayMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para adicionar data de vencimento */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Data de Vencimento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="due-date">Data de Vencimento</Label>
              <Input 
                id="due-date" 
                type="date" 
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button 
              onClick={() => selectedTransactionId && updateDueDateMutation.mutate({ transactionId: selectedTransactionId, date: dueDate })}
              disabled={!dueDate || updateDueDateMutation.isPending}
            >
              {updateDueDateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataMigrationTool;