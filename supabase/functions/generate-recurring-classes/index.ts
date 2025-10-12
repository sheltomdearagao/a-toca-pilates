// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// Atualizado date-fns para a versão 3.6.0 para compatibilidade
import { addDays, format, parseISO, isWithinInterval, startOfDay, endOfDay, setHours, setMinutes, setSeconds } from "https://esm.sh/date-fns@3.6.0";
// Forçando date-fns-tz a usar date-fns@3.6.0 como dependência
import { zonedTimeToUtc, utcToZonedTime } from "https://esm.sh/date-fns-tz@2.0.0?deps=date-fns@3.6.0"; 

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Assumimos que o fuso horário da academia é 'America/Sao_Paulo' ou similar
// Para um ambiente de produção, isso deveria ser configurável ou determinado pelo contexto.
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
    const today = startOfDay(utcToZonedTime(new Date(), APP_TIMEZONE)); // Obter 'hoje' no fuso horário da academia
    const twoMonthsFromNow = addDays(today, 60); // Gerar classes para os próximos 60 dias

    // Fetch all recurring class templates
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
            // Combinar a data do dia atual com a hora do template no fuso horário da academia
            let startDateTime = setHours(currentDate, parseInt(template.start_time_of_day.substring(0, 2)));
            startDateTime = setMinutes(startDateTime, parseInt(template.start_time_of_day.substring(3, 5)));
            startDateTime = setSeconds(startDateTime, parseInt(template.start_time_of_day.substring(6, 8) || '00'));

            let endDateTime = setHours(currentDate, parseInt(template.end_time_of_day.substring(0, 2)));
            endDateTime = setMinutes(endDateTime, parseInt(template.end_time_of_day.substring(3, 5)));
            endDateTime = setSeconds(endDateTime, parseInt(template.end_time_of_day.substring(6, 8) || '00'));

            // Converter para UTC para armazenar no banco de dados
            const startUtc = zonedTimeToUtc(startDateTime, APP_TIMEZONE).toISOString();
            const endUtc = zonedTimeToUtc(endDateTime, APP_TIMEZONE).toISOString();

            // Check for existing class to prevent duplicates
            const { count: existingClassCount, error: existingClassError } = await supabase
              .from('classes')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', template.user_id)
              .eq('title', template.title)
              .eq('start_time', startUtc)
              .eq('end_time', endUtc);

            if (existingClassError) throw existingClassError;

            if (existingClassCount === 0) {
              classesToInsert.push({
                user_id: template.user_id,
                title: template.title,
                start_time: startUtc,
                end_time: endUtc,
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