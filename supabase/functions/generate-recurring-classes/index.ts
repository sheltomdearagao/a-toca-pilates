/// <reference lib="deno.ns" />
// @deno-types="https://deno.land/std@0.190.0/http/server.ts"
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @deno-types="https://esm.sh/@supabase/supabase-js@2.45.0"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @deno-types="https://esm.sh/date-fns@3.6.0"
import { addDays, format, parseISO, isWithinInterval, startOfDay, setHours, setMinutes, setSeconds, addMinutes } from "https://esm.sh/date-fns@3.6.0";
// @deno-types="https://esm.sh/date-fns-tz@3.0.0"
import { toZonedTime, toUtc } from "https://esm.sh/date-fns-tz@3.0.0"; 

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_TIMEZONE = 'America/Sao_Paulo'; 

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const classesToInsert = [];
    const today = startOfDay(toZonedTime(new Date(), APP_TIMEZONE)); 
    const twoMonthsFromNow = addDays(today, 60);

    const { data: templates, error: templatesError } = await supabase
      .from('recurring_class_templates')
      .select('*');

    if (templatesError) throw templatesError;

    for (const template of templates) {
      const templateStartDate = parseISO(template.recurrence_start_date);
      const templateEndDate = template.recurrence_end_date ? parseISO(template.recurrence_end_date) : null;

      for (let i = 0; i <= 60; i++) {
        const currentDate = addDays(today, i);
        const dayOfWeek = format(currentDate, 'EEEE', { locale: { code: 'en-US' } }).toLowerCase();

        if (isWithinInterval(currentDate, { start: templateStartDate, end: twoMonthsFromNow })) {
          if (templateEndDate && currentDate > templateEndDate) {
            continue;
          }

          if (template.recurrence_days_of_week.includes(dayOfWeek)) {
            let startDateTime = setHours(currentDate, parseInt(template.start_time_of_day.substring(0, 2)));
            startDateTime = setMinutes(startDateTime, parseInt(template.start_time_of_day.substring(3, 5)));
            startDateTime = setSeconds(startDateTime, 0); // Set seconds to 0 for consistency

            // Calculate endDateTime based on startDateTime and duration_minutes
            const endDateTime = addMinutes(startDateTime, template.duration_minutes);

            const startUtc = toUtc(startDateTime, { timeZone: APP_TIMEZONE }).toISOString();
            // end_time is no longer stored in the classes table, so we don't need to calculate endUtc for insertion
            // const endUtc = toUtc(endDateTime, { timeZone: APP_TIMEZONE }).toISOString();

            const { count: existingClassCount, error: existingClassError } = await supabase
              .from('classes')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', template.user_id)
              .eq('title', template.title)
              .eq('start_time', startUtc)
              .eq('duration_minutes', template.duration_minutes); // Check duration_minutes instead of end_time

            if (existingClassError) throw existingClassError;

            if (existingClassCount === 0) {
              classesToInsert.push({
                user_id: template.user_id,
                title: template.title,
                start_time: startUtc,
                duration_minutes: template.duration_minutes, // Store duration_minutes
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