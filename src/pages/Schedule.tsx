import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import { ClassEvent } from '@/types/schedule';

const fetchClasses = async (): Promise<ClassEvent[]> => {
  const { data, error } = await supabase.from('classes').select('*');
  if (error) throw new Error(error.message);
  return data || [];
};

const Schedule = () => {
  const [isFormOpen, setFormOpen] = useState(false);
  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  const calendarEvents = classes?.map(c => ({
    id: c.id,
    title: c.title,
    start: c.start_time,
    end: c.end_time,
  })) || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Agenda de Aulas</h1>
        <Button onClick={() => setFormOpen(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Agendar Aula
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-card p-4 rounded-lg border">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            buttonText={{
              today:    'Hoje',
              month:    'Mês',
              week:     'Semana',
              day:      'Dia',
            }}
            events={calendarEvents}
            locale="pt-br"
            allDaySlot={false}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            height="auto"
          />
        </div>
      )}
      
      <AddClassDialog isOpen={isFormOpen} onOpenChange={setFormOpen} />
    </div>
  );
};

export default Schedule;