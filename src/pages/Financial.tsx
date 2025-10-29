import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialTransaction, TransactionType } from '@/types/financial';
import { StudentOption } from '@/types/student';
import { formatCurrency } from '@/utils/formatters';
import { showError, showSuccess } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import FinancialOverviewCards from '@/components/financial/FinancialOverviewCards';
import MonthlyFinancialChart from '@/components/financial/MonthlyFinancialChart';
import OverdueTransactionsTable from '@/components/financial/OverdueTransactionsTable';
import AllTransactionsTable from '@/components/financial/AllTransactionsTable';
import AddEditTransactionDialog, { TransactionFormData } from '@/components/financial/AddEditTransactionDialog';
import DeleteTransactionAlertDialog from '@/components/financial/DeleteTransactionAlertDialog';
import CategoryManagerDialog from '@/components/financial/CategoryManagerDialog';
import ColoredSeparator from '@/components/ColoredSeparator';
import { startOfMonth, endOfMonth, subMonths, format, parseISO, parse as parseMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Search } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';

interface FinancialStats {
  monthlyRevenue: number;
  monthlyExpense: number;
  totalOverdue: number;
}

interface ChartData {
  month: string;
  Receita: number;
  Despesa: number;
}

- const fetchFinancialData = async (): Promise<{ transactions: FinancialTransaction[], stats: FinancialStats, chartData: ChartData[], students: StudentOption[] }> => {
+ const fetchFinancialData = async (): Promise<{ transactions: FinancialTransaction[], stats: FinancialStats, chartData: ChartData[], students: StudentOption[] }> => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
 
  const { data: transactionsData, error: transactionsError } = await supabase
    .from('financial_transactions')
    .select(`
      *,
      students(name, enrollment_type)
    `)
    .order('created_at', { ascending: false });

  if (transactionsError) throw new Error(transactionsError.message);
  const transactions = transactionsData || [];

  const { data: studentsData, error: studentsError } = await supabase
    .from('students')
    .select('id, name, enrollment_type')
    .order('name');

  if (studentsError) throw new Error(studentsError.message);

- // Lazy fetch removed. We'll rely on app settings hook for dynamic categories.
- const settings = { revenue_categories: [], expense_categories: [], enrollment_types: [] };
+ // Lazy fetch removed. We'll rely on app settings hook for dynamic categories.
+ const settings = { revenue_categories: [], expense_categories: [], enrollment_types: [] } as const;
 
  // Calculations for stats
  let monthlyRevenue = 0;
  let monthlyExpense = 0;
  let totalOverdue = 0;

  const overdueTransactions = transactions.filter(t =>
    t.type === 'revenue' &&
    (t.status === 'Atrasado' || (t.status === 'Pendente' && t.due_date && parseISO(t.due_date) < now))
  );
  totalOverdue = overdueTransactions.reduce((sum, t) => sum + t.amount, 0);

  transactions.forEach(t => {
    const paidAt = t.paid_at ? parseISO(t.paid_at) : null;
    if (paidAt && paidAt >= monthStart && paidAt <= monthEnd) {
      if (t.type === 'revenue') {
        monthlyRevenue += t.amount;
      } else if (t.type === 'expense') {
        monthlyExpense += t.amount;
      }
    }
  });

  // Chart data for last 6 months
  const chartDataMap: Record<string, { Receita: number, Despesa: number }> = {};
  for (let i = 0; i < 6; i++) {
    const date = subMonths(now, i);
    const monthKey = format(date, 'MMM/yy', { locale: ptBR });
    chartDataMap[monthKey] = { Receita: 0, Despesa: 0 };
  }

  transactions.forEach(t => {
    const paidAt = t.paid_at ? parseISO(t.paid_at) : null;
    if (paidAt) {
      const monthKey = format(paidAt, 'MMM/yy', { locale: ptBR });
      if (chartDataMap[monthKey]) {
-        if (t.type === 'revenue') chartDataMap[monthKey].Receita += t.amount;
-        if (t.type === 'expense') chartDataMap[monthKey].Despesa += t.amount;
+        if (t.type === 'revenue') chartDataMap[monthKey].Receita += t.amount;
+        if (t.type === 'expense') chartDataMap[monthKey].Despesa += t.amount;
       }
     }
   });

-   const chartData: ChartData[] = Object.keys(chartDataMap)
-     .sort((a, b) => parse(a, 'MMM/yy', new Date()).getTime() - parse(b, 'MMM/yy', new Date()).getTime())
-     .map(month => ({
-       month,
-       Receita: chartDataMap[month].Receita,
-       Despesa: chartDataMap[month].Despesa,
-     }));
+  const chartData: ChartData[] = Object.keys(chartDataMap)
+    .sort((a, b) => parseMonth(a, 'MMM/yy', new Date()).getTime() - parseMonth(b, 'MMM/yy', new Date()).getTime())
+    .map((month) => ({
+      month,
+      Receita: chartDataMap[month].Receita,
+      Despesa: chartDataMap[month].Despesa,
+    }));
 
   return { transactions, stats: { monthlyRevenue, monthlyExpense, totalOverdue }, chartData, students: (studentsData || []) };
 };
 
 const Financial = () => {
  ...

<dyad-write> (continues with the rest of the updated file content, ensuring the rest of the component remains intact)