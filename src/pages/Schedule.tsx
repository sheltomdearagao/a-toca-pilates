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
import RecurringClassTemplatesTab from '@/components/schedule/RecurringClassTemplatesTab';
import { ClassEvent } from '@/types/schedule';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppSettings } from '@/hooks/useAppSettings';
import ColoredSeparator from "@/components/ColoredSeparator";
import { parseISO, format } from 'date-fns'; // Importar format
import { utcToZonedTime } from 'date-fns-tz'; // Importar utcToZonedTime

const fetchClasses = async (): Promise<ClassEvent[]> => {
  const { data, error } = await supabase.from('classes').select('*, class_attendees(count), students(name)');
  if (error) throw new Error(error.message);
  
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (data as any[] || []).map(c => ({
    ...c,
    // Converter de ISO string UTC para Date object no fuso horário local
    start_time: utcToZonedTime(parseISO(c.start_time), timeZone),
    end_time: utcToZonedTime(parseISO(c.end_time), timeZone),
  }));
};

const Schedule = () => {
  const [isAddFormOpen, setAddFormOpen] = useState(false);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Partial<ClassEvent> | null>(null);
  const [calendarView, setCalendarView] = useState('timeGridDay');

  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const CLASS_CAPACITY = appSettings?.class_capacity ?? 10;

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: fetchClasses,
  });

  const isLoading = isLoadingSettings || isLoadingClasses;

  const calendarEvents = classes?.map(c => {
    const attendeeCount = c.class_attendees[0]?.count ?? 0;
    const eventTitle = c.student_id && c.students ? `Aula com ${c.students.name}` : c.title;
    return {
      id: c.id,
      title: eventTitle,
      start: c.start_time.toISOString(), // FullCalendar espera ISO string
      end: c.end_time.toISOString(), // FullCalendar espera ISO string
      notes: c.notes,
      extendedProps: {
        attendeeCount,
        student_id: c.student_id,
      },
    };
  }) || [];

  const handleEventClick = (clickInfo: EventClickArg) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setSelectedEvent({
      id: clickInfo.event.id,
      title: clickInfo.event.title,
      // Converter de ISO string (do FullCalendar) para Date object no fuso horário local
      start_time: utcToZonedTime(parseISO(clickInfo.event.startStr), timeZone),
      end_time: utcToZonedTime(parseISO(clickInfo.event.endStr), timeZone),
      notes: clickInfo.event.extendedProps.notes,
      student_id: clickInfo.event.extendedProps.student_id,
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

      <ColoredSeparator color="primary" className="my-6" />

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
                initialView={calendarView}
                views={{
                  timeGridTwoWeeks: {
                    type: 'timeGrid',
                    duration: { days: 14 },
                    buttonText: '15 Dias'
                  }
                }}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'timeGridDay,timeGridWeek,timeGridTwoWeeks',
                }}
                buttonText={{
                  today:    'Hoje',
                  day:      'Dia',
                  week:     'Semana',
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
      <ClassDetailsDialog isOpen={isDetailsOpen} onOpenChange={setDetailsOpen} classEvent={selectedEvent} classCapacity={CLASS_CAPACITY} />
    </div>
  );
};

export default Schedule;