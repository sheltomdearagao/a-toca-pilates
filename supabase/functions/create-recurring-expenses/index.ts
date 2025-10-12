// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { startOfMonth, endOfMonth, format } from "https://deno.land/x/date_fns@v2.29.3/index.js";

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
          user_id: expense.user_id,
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