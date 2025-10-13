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
import { parseISO, format, addMinutes } from 'date-fns';

// Otimizando a consulta para buscar apenas as aulas dentro de um período
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
    .gte('start_time', start) // Filtrar por data de início
    .lte('start_time', end)   // Filtrar por data de fim
    .order('start_time', { ascending: true });
  
  if (error) throw new Error(error.message);
  
  return (data as any[] || []).map(c => ({
    id: c.id,
    user_id: c.user_id,
    title: c.title,
    start_time: c.start_time,
    duration_minutes: c.duration_minutes,
    notes: c.notes,
    created_at: c.created_at,
    student_id: c.student_id,
    students: c.students ? (c.students as { name: string }) : null, // Ajustado para objeto único ou null
    class_attendees: c.class_attendees,
  }));
};

const Schedule = () => {
  const [isAddFormOpen, setAddFormOpen] = useState(false);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Partial<ClassEvent> | null>(null);
  const [calendarView, setCalendarView] = useState('timeGridDay');
  const [currentCalendarRange, setCurrentCalendarRange] = useState<{ start: string; end: string }>({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(addMinutes(new Date(), 1), 'yyyy-MM-dd'), // Pequeno range inicial
  });

  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const CLASS_CAPACITY = appSettings?.class_capacity ?? 10;

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes', currentCalendarRange.start, currentCalendarRange.end], // Chave de query depende do range
    queryFn: () => fetchClasses(currentCalendarRange.start, currentCalendarRange.end),
    enabled: !!currentCalendarRange.start && !!currentCalendarRange.end, // Só executa se as datas estiverem definidas
    staleTime: 1000 * 60 * 1, // Cache por 1 minuto para agilidade
  });

  const isLoading = isLoadingSettings || isLoadingClasses;

  const calendarEvents = classes?.map(c => {
    const attendeeCount = c.class_attendees[0]?.count ?? 0;
    const eventTitle = c.student_id && c.students ? `Aula com ${c.students.name}` : c.title || 'Aula';
    
    const startTime = parseISO(c.start_time);
    const endTime = addMinutes(startTime, c.duration_minutes);

    return {
      id: c.id,
      title: eventTitle,
      start: c.start_time,
      end: endTime.toISOString(),
      extendedProps: {
        attendeeCount,
        student_id: c.student_id,
        notes: c.notes,
        duration_minutes: c.duration_minutes,
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

  // Callback para atualizar o range de datas do calendário
  const handleDatesSet = useCallback((dateInfo: DatesSetArg) => {
    setCurrentCalendarRange({
      start: dateInfo.startStr,
      end: dateInfo.endStr,
    });
  }, []);

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
          <TabsTrigger value="recurring-templates">Alunos Recorrentes</TabsTrigger> {/* Alterado o nome da aba */}
        </TabsList>
        <TabsContent value="calendar" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-[60vh]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando agenda...</span>
            </div>
          ) : (
            <div className="bg-card p-4 rounded-lg border shadow-subtle-glow"> {/* Added shadow-subtle-glow */}
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
                datesSet={handleDatesSet}
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