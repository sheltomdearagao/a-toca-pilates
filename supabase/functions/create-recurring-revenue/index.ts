// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"; // Updated Deno std version
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'; // Updated Supabase client version
import { startOfMonth, endOfMonth, subMonths, startOfQuarter } from "https://esm.sh/date-fns@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DUE_DAY = 10;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), DUE_DAY);

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('status', 'Ativo')
      .in('plan_type', ['Mensal', 'Trimestral']);

    if (studentsError) throw studentsError;

    const newTransactions = [];

    for (const student of students) {
      let shouldCreate = false;
      if (student.plan_type === 'Mensal') {
        const monthStart = startOfMonth(now);
        const { data: existing, error } = await supabase
          .from('financial_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', student.id)
          .gte('created_at', monthStart.toISOString());
        if (error) throw error;
        if (existing.length === 0) shouldCreate = true;

      } else if (student.plan_type === 'Trimestral') {
        const quarterStart = startOfQuarter(now);
        const { data: existing, error } = await supabase
          .from('financial_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', student.id)
          .gte('created_at', quarterStart.toISOString());
        if (error) throw error;
        if (existing.length === 0) shouldCreate = true;
      }

      if (shouldCreate && student.monthly_fee && student.monthly_fee > 0) {
        newTransactions.push({
          user_id: student.user_id,
          student_id: student.id,
          description: `Mensalidade ${student.plan_type} - ${student.name}`,
          category: 'Mensalidade',
          amount: student.monthly_fee,
          type: 'revenue',
          status: 'Pendente',
          due_date: dueDate.toISOString().split('T')[0],
        });
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