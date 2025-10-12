// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { startOfMonth, endOfMonth, addDays } from "https://esm.sh/date-fns@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DUE_DAY = 10; // Vencimento no dia 10 de cada mês

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Usar service_role_key para operações de backend
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const dueDate = new Date(now.getFullYear(), now.getMonth(), DUE_DAY);

    // 1. Buscar todos os alunos com plano mensal ativo
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('status', 'Ativo')
      .eq('plan_type', 'Mensal');

    if (studentsError) throw studentsError;

    const newTransactions = [];

    for (const student of students) {
      // 2. Verificar se a mensalidade já foi gerada este mês
      const { data: existing, error: existingError } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('student_id', student.id)
        .eq('category', 'Mensalidade')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .limit(1);

      if (existingError) throw existingError;

      // 3. Se não existir, criar a nova transação
      if (!existing || existing.length === 0) {
        if (student.monthly_fee && student.monthly_fee > 0) {
          newTransactions.push({
            user_id: student.user_id,
            student_id: student.id,
            description: `Mensalidade - ${student.name}`,
            category: 'Mensalidade',
            amount: student.monthly_fee,
            type: 'revenue',
            status: 'Pendente',
            due_date: dueDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
          });
        }
      }
    }

    if (newTransactions.length > 0) {
      const { error: insertError } = await supabase
        .from('financial_transactions')
        .insert(newTransactions);
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ message: `Created ${newTransactions.length} new revenue transactions.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});