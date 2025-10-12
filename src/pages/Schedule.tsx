import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, EventContentArg } from '@fullcalendar/core';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import ClassDetailsDialog from '@/components/schedule/ClassDetailsDialog';
import RecurringClassTemplatesTab from '@/components/schedule/RecurringClassTemplatesTab'; // Importar o novo componente
import { ClassEvent } from '@/types/schedule';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CLASS_CAPACITY = 10;

const fetchClasses = async (): Promise<ClassEvent[]> => {
  const { data, error } = await supabase.from('classes').select('*, class_attendees(count)');
  if (error) throw new Error(error.message);
  return (data as any) || [];
};

const Schedule = () => {
  const [isAddFormOpen, setAddFormOpen] = useState(false);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Partial<ClassEvent> | null>(null);

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  const calendarEvents = classes?.map(c => {
    const attendeeCount = c.class_attendees[0]?.count ?? 0;
    return {
      id: c.id,
      title: c.title,
      start: c.start_time,
      end: c.end_time,
      notes: c.notes,
      extendedProps: {
        attendeeCount,
      },
    };
  }) || [];

  const handleEventClick = (clickInfo: EventClickArg) => {
    setSelectedEvent({
      id: clickInfo.event.id,
      title: clickInfo.event.title,
      start_time: clickInfo.event.startStr,
      end_time: clickInfo.event.endStr,
      notes: clickInfo.event.extendedProps.notes,
    });
    setDetailsOpen(true);
  };

  const renderEventContent = (eventInfo: EventContentArg) => {
    const { attendeeCount } = eventInfo.event.extendedProps;
    return (
      <div className="p-1 overflow-hidden">
        <b>{eventInfo.timeText}</b>
        <p className="truncate">{eventInfo.event.title}</p>
        <p className="text-sm font-semibold">({attendeeCount}/{CLASS_CAPACITY})</p>
      </div>
    );
  };

  const getEventClassNames = (eventInfo: EventContentArg) => {
    const { attendeeCount } = eventInfo.event.extendedProps;
    if (attendeeCount >= CLASS_CAPACITY) {
      return 'event-full';
    }
    if (attendeeCount >= CLASS_CAPACITY - 3) {
      return 'event-few-spots';
    }
    return 'event-available';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Agenda de Aulas</h1>
        <Button onClick={() => setAddFormOpen(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Agendar Aula
        </Button>
      </div>

      <Tabs defaultValue="calendar">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
          <TabsTrigger value="recurring-templates">Modelos Recorrentes</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="mt-4">
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
                eventClick={handleEventClick}
                eventContent={renderEventContent}
                eventClassNames={getEventClassNames}
              />
            </div>
          )}
        </TabsContent>
        <TabsContent value="recurring-templates" className="mt-4">
          <RecurringClassTemplatesTab />
        </TabsContent>
      </Tabs>
      
      <AddClassDialog isOpen={isAddFormOpen} onOpenChange={setAddFormOpen} />
      <ClassDetailsDialog isOpen={isDetailsOpen} onOpenChange={setDetailsOpen} classEvent={selectedEvent} />
    </div>
  );
};

export default Schedule;