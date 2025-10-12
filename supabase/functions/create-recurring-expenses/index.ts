// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { startOfMonth, endOfMonth } from "https://esm.sh/date-fns@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use SUPABASE_SERVICE_ROLE_KEY for elevated permissions
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Corrected to use SERVICE_ROLE_KEY
      { auth: { persistSession: false } } // No user session needed for service role
    );

    // No need to call supabase.auth.getUser() as we are using the service role key
    // and this function is meant to run as a background job.

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // 1. Get all recurring expense templates
    const { data: recurringExpenses, error: recurringError } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('is_recurring', true)
      .eq('type', 'expense');

    if (recurringError) throw recurringError;

    const newTransactions = [];

    for (const expense of recurringExpenses) {
      // 2. Check if a transaction for this month already exists
      const { data: existing, error: existingError } = await supabase
        .from('financial_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('description', expense.description)
        .eq('category', expense.category)
        .eq('amount', expense.amount)
        .eq('type', 'expense')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (existingError) throw existingError;

      // 3. If it doesn't exist, create it
      if (existing === null || existing.length === 0) {
        newTransactions.push({
          user_id: expense.user_id, // Keep user_id from the template
          description: expense.description,
          amount: expense.amount,
          type: 'expense',
          category: expense.category,
          is_recurring: false, // The new transaction is not a template
          created_at: now.toISOString(),
        });
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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});