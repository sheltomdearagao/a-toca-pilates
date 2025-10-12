// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths } from "https://esm.sh/date-fns@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    // Fetch all recurring expense templates from the new table
    const { data: templates, error: templatesError } = await supabase
      .from('recurring_expense_templates')
      .select('*');

    if (templatesError) throw templatesError;

    const newTransactions = [];

    for (const template of templates) {
      const templateStartDate = parseISO(template.start_date);
      const templateEndDate = template.end_date ? parseISO(template.end_date) : null;

      // Check if the template is active for the current month
      if (isWithinInterval(now, { start: templateStartDate, end: templateEndDate || addMonths(now, 1) })) {
        // Check if a transaction for this template and month already exists
        const { count: existingTransactionCount, error: existingTransactionError } = await supabase
          .from('financial_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', template.user_id)
          .eq('description', template.description)
          .eq('category', template.category)
          .eq('amount', template.amount)
          .eq('type', 'expense')
          .gte('created_at', currentMonthStart.toISOString())
          .lte('created_at', currentMonthEnd.toISOString());

        if (existingTransactionError) throw existingTransactionError;

        if (existingTransactionCount === 0) {
          newTransactions.push({
            user_id: template.user_id,
            description: template.description,
            amount: template.amount,
            type: 'expense',
            category: template.category,
            is_recurring: true, // Corrected: Mark as true for transactions generated from templates
            created_at: now.toISOString(),
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

    return new Response(JSON.stringify({ message: `Created ${newTransactions.length} new recurring expenses.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error generating recurring expenses:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});