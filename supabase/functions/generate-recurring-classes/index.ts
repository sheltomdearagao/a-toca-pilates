// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { addDays, format, parseISO, isWithinInterval, startOfDay, endOfDay } from "https://esm.sh/date-fns@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const dayOfWeekMap: { [key: string]: number } = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use SUPABASE_SERVICE_ROLE_KEY for elevated permissions
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Fetch all recurring class templates
    const { data: templates, error: templatesError } = await supabase
      .from('recurring_class_templates')
      .select('*');

    if (templatesError) throw templatesError;

    const classesToInsert = [];
    const today = startOfDay(new Date());
    const twoMonthsFromNow = addDays(today, 60); // Generate classes for the next 60 days

    for (const template of templates) {
      const templateStartDate = parseISO(template.recurrence_start_date);
      const templateEndDate = template.recurrence_end_date ? parseISO(template.recurrence_end_date) : null;

      for (let i = 0; i <= 60; i++) { // Iterate for the next 60 days
        const currentDate = addDays(today, i);
        const dayOfWeek = format(currentDate, 'EEEE', { locale: { code: 'en-US' } }).toLowerCase(); // Get day name in English

        // Check if current date is within template's recurrence period
        if (isWithinInterval(currentDate, { start: templateStartDate, end: twoMonthsFromNow })) {
          if (templateEndDate && currentDate > templateEndDate) {
            continue; // Skip if beyond template's end date
          }

          if (template.recurrence_days_of_week.includes(dayOfWeek)) {
            const startTime = `${format(currentDate, 'yyyy-MM-dd')}T${template.start_time_of_day}`;
            const endTime = `${format(currentDate, 'yyyy-MM-dd')}T${template.end_time_of_day}`;

            // Check for existing class to prevent duplicates
            const { count: existingClassCount, error: existingClassError } = await supabase
              .from('classes')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', template.user_id)
              .eq('title', template.title)
              .eq('start_time', startTime)
              .eq('end_time', endTime);

            if (existingClassError) throw existingClassError;

            if (existingClassCount === 0) {
              classesToInsert.push({
                user_id: template.user_id,
                title: template.title,
                start_time: startTime,
                end_time: endTime,
                notes: template.notes,
              });
            }
          }
        }
      }
    }

    if (classesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('classes')
        .insert(classesToInsert);
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ message: `Generated ${classesToInsert.length} new recurring classes.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error generating recurring classes:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});