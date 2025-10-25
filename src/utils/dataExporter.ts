import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';
import { showError } from './toast';

// Mapeamento de tabelas e colunas a serem exportadas
const EXPORT_CONFIG = {
  students: {
    table: 'students',
    columns: 'id, name, email, phone, status, plan_type, plan_frequency, monthly_fee, enrollment_type, date_of_birth, validity_date, preferred_days, preferred_time, notes, created_at',
    filename: 'alunos_backup',
  },
  financial_transactions: {
    table: 'financial_transactions',
    columns: 'id, student_id, description, category, amount, type, status, due_date, paid_at, is_recurring, created_at',
    filename: 'transacoes_financeiras_backup',
  },
  classes: {
    table: 'classes',
    columns: 'id, title, start_time, duration_minutes, notes, student_id, recurring_class_template_id, created_at',
    filename: 'aulas_backup',
  },
};

type ExportableTable = keyof typeof EXPORT_CONFIG;

const downloadCsv = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportDataToCsv = async (tableKey: ExportableTable) => {
  const config = EXPORT_CONFIG[tableKey];
  if (!config) {
    showError('Tabela de exportação inválida.');
    return;
  }

  try {
    // Busca todos os dados da tabela
    const { data, error } = await supabase
      .from(config.table)
      .select(config.columns)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      showError(`Nenhum dado encontrado para exportar na tabela ${config.table}.`);
      return;
    }

    // Converte JSON para CSV
    const csv = Papa.unparse(data);
    
    // Aciona o download
    downloadCsv(csv, config.filename);
    
    return true;

  } catch (error: any) {
    console.error('Erro durante a exportação:', error);
    showError(`Falha na exportação: ${error.message}`);
    return false;
  }
};