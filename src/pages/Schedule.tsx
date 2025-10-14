import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, EventContentArg, DatesSetArg } from '@fullcalendar/core';
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
import { parseISO, format, addMinutes, addHours, setMinutes, setSeconds } from 'date-fns';

// Consulta otimizada para buscar apenas as aulas do período visível
const fetchClasses = async (start: string, end: string): Promise<ClassEvent[]> => {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id,
      user_id,
      title,
      start_time,
      duration_minutes,
      notes,
      created_at,
      student_id,
      students(name),
      class_attendees(count)
    `)
    .gte('start_time', start)
    .lte('start_time', end)
    .order('start_time', { ascending: true });
  
  if (error) throw new Error(error.message);
  
  return (data as any[] || []).map(c => ({
    id: c.id,
    user_id: c.user_id,
    title: c.title,
    start_time: c.start_time,
    duration_minutes: c.duration_minutes || 60, // Default para 60 minutos
    notes: c.notes,
    created_at: c.created_at,
    student_id: c.student_id,
    students: c.students ? (c.students as { name: string }) : null,
    class_attendees: c.class_attendees,
  }));
};

const Schedule = () => {
  const [isAddFormOpen, setAddFormOpen] = useState(false);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Partial<ClassEvent> | null>(null);
  const [currentCalendarRange, setCurrentCalendarRange] = useState<{ start: string; end: string }>({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(addMinutes(new Date(), 1), 'yyyy-MM-dd'),
  });

  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const CLASS_CAPACITY = appSettings?.class_capacity ?? 10;

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes', currentCalendarRange.start, currentCalendarRange.end],
    queryFn: () => fetchClasses(currentCalendarRange.start, currentCalendarRange.end),
    enabled: !!currentCalendarRange.start && !!currentCalendarRange.end,
    staleTime: 1000 * 60 * 1,
  });

  const isLoading = isLoadingSettings || isLoadingClasses;

  // Mapear aulas para o formato do FullCalendar
  const calendarEvents = classes?.map(c => {
    const attendeeCount = c.class_attendees[0]?.count ?? 0;
    const eventTitle = c.student_id && c.students ? `Aula com ${c.students.name}` : c.title || 'Aula';
    const startTime = parseISO(c.start_time);
    const endTime = addMinutes(startTime, c.duration_minutes || 60);

    return {
      id: c.id,
      title: eventTitle,
      start: c.start_time,
      end: endTime.toISOString(),
      extendedProps: {
        attendeeCount,
        capacity: CLASS_CAPACITY,
        student_id: c.student_id,
        notes: c.notes,
        duration_minutes: c.duration_minutes || 60,
      },
    };
  }) || [];

  const handleEventClick = (clickInfo: EventClickArg) => {
    setSelectedEvent({
      id: clickInfo.event.id,
      title: clickInfo.event.title,
      start_time: clickInfo.event.startStr,
      duration_minutes: clickInfo.event.extendedProps.duration_minutes,
      notes: clickInfo.event.extendedProps.notes,
      student_id: clickInfo.event.extendedProps.student_id,
    });
    setDetailsOpen(true);
  };

  const renderEventContent = (eventInfo: EventContentArg) => {
    const { attendeeCount, capacity } = eventInfo.event.extendedProps;
    return (
      <div className="p-1 overflow-hidden">
        <b className="text-xs">{eventInfo.timeText}</b>
        <p className="truncate text-xs">{eventInfo.event.title}</p>
        <p className="text-xs font-semibold">({attendeeCount}/{capacity})</p>
      </div>
    );
  };

  const getEventClassNames = (eventInfo: EventContentArg) => {
    const { attendeeCount, capacity } = eventInfo.event.extendedProps;
    if (attendeeCount >= capacity) {
      return 'event-full';
    }
    if (attendeeCount >= capacity - 3) {
      return 'event-few-spots';
    }
    return 'event-available';
  };

  const handleDatesSet = useCallback((dateInfo: DatesSetArg) => {
    setCurrentCalendarRange({
      start: dateInfo.startStr,
      end: dateInfo.endStr,
    });
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Agenda de Aulas</h1>
        <Button onClick={() => setAddFormOpen(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Agendar Aula
        </Button>
      </div>

      <ColoredSeparator color="primary" className="my-6" />

      <Tabs defaultValue="calendar" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
          <TabsTrigger value="recurring-templates">Modelos Recorrentes</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="mt-4 flex-1">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando agenda...</span>
            </div>
          ) : (
            <div className="bg-card p-4 rounded-lg border shadow-subtle-glow h-full">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                views={{
                  timeGridDay: { 
                    buttonText: 'Dia',
                    slotDuration: '00:30:00'
                  },
                  timeGridWeek: { 
                    buttonText: 'Semana',
                    slotDuration: '01:00:00'
                  },
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
                  today: 'Hoje',
                  day: 'Dia',
                  week: 'Semana',
                }}
                events={calendarEvents}
                locale="pt-br"
                allDaySlot={false}
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                slotLabelFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  omitZeroMinute: false,
                  meridiem: 'short'
                }}
                height="100%"
                contentHeight="auto"
                eventClick={handleEventClick}
                eventContent={renderEventContent}
                eventClassNames={getEventClassNames}
                datesSet={handleDatesSet}
                eventOverlap={false}
                weekends={false}
                firstDay={1}
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