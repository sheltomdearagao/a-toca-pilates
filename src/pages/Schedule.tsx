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

// Helper para gerar slots de horário por hora
const generateTimeSlots = (start: Date, end: Date, capacity: number): any[] => {
  const slots = [];
  let current = start;
  // Ajustar para começar do início da primeira hora no range
  current = setMinutes(setSeconds(current, 0), 0);

  while (current < end) {
    const nextHour = addHours(current, 1);
    // Apenas gerar slots dentro do horário de funcionamento (ex: 6h às 22h)
    if (current.getHours() >= 6 && current.getHours() < 22) {
      slots.push({
        id: `slot-${format(current, 'yyyy-MM-dd-HH')}`, // ID único para cada slot de hora
        start: current.toISOString(),
        end: nextHour.toISOString(),
        title: `Vagas: ${capacity}`,
        display: 'background', // Renderizar como evento de fundo
        classNames: ['empty-slot'], // Classe customizada para estilização
        extendedProps: {
          attendeeCount: 0,
          capacity: capacity,
          isEmptySlot: true,
        },
      });
    }
    current = nextHour;
  }
  return slots;
};

const Schedule = () => {
  const [isAddFormOpen, setAddFormOpen] = useState(false);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Partial<ClassEvent> | null>(null);
  const [calendarView, setCalendarView] = useState('timeGridWeek'); // Definido como 'timeGridWeek' por padrão
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

  // Gerar slots de horário para o range de visualização atual
  const startOfView = parseISO(currentCalendarRange.start);
  const endOfView = parseISO(currentCalendarRange.end);
  const generatedSlots = generateTimeSlots(startOfView, endOfView, CLASS_CAPACITY);

  // Mapear aulas reais para o formato de evento do FullCalendar
  const actualClassEvents = classes?.map(c => {
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
        capacity: CLASS_CAPACITY,
        student_id: c.student_id,
        notes: c.notes,
        duration_minutes: c.duration_minutes,
        isEmptySlot: false,
      },
      display: 'auto', // Evento regular, será sobreposto aos eventos de fundo
    };
  }) || [];

  // Combinar slots gerados e eventos de aulas reais
  // O FullCalendar renderizará eventos de fundo primeiro, depois eventos regulares por cima.
  const combinedEvents = [...generatedSlots, ...actualClassEvents];

  const handleEventClick = (clickInfo: EventClickArg) => {
    // Apenas eventos de aulas reais devem abrir o modal de detalhes
    if (!clickInfo.event.extendedProps.isEmptySlot) {
      setSelectedEvent({
        id: clickInfo.event.id,
        title: clickInfo.event.title,
        start_time: clickInfo.event.startStr,
        duration_minutes: clickInfo.event.extendedProps.duration_minutes,
        notes: clickInfo.event.extendedProps.notes,
        student_id: clickInfo.event.extendedProps.student_id,
      });
      setDetailsOpen(true);
    }
  };

  const renderEventContent = (eventInfo: EventContentArg) => {
    const { attendeeCount, capacity, isEmptySlot } = eventInfo.event.extendedProps;

    if (isEmptySlot) {
      return (
        <div className="p-1 text-center text-muted-foreground text-sm opacity-70">
          Vagas: {capacity}
        </div>
      );
    }

    return (
      <div className="p-1 overflow-hidden">
        <b>{eventInfo.timeText}</b>
        <p className="truncate">{eventInfo.event.title}</p>
        <p className="text-sm font-semibold">({attendeeCount}/{capacity})</p>
      </div>
    );
  };

  const getEventClassNames = (eventInfo: EventContentArg) => {
    const { attendeeCount, capacity, isEmptySlot } = eventInfo.event.extendedProps;

    if (isEmptySlot) {
      return 'empty-slot-background'; // Classe customizada para estilizar slots vazios
    }

    if (attendeeCount >= capacity) {
      return 'event-full';
    }
    if (attendeeCount >= capacity - 3) {
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
          <TabsTrigger value="recurring-templates">Modelos Recorrentes</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-[60vh]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando agenda...</span>
            </div>
          ) : (
            <div className="bg-card p-4 rounded-lg border shadow-subtle-glow">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek" // Padrão para visualização semanal para melhor visibilidade dos slots
                views={{
                  timeGridDay: { buttonText: 'Dia' },
                  timeGridWeek: { buttonText: 'Semana' },
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
                events={combinedEvents} // Usar eventos combinados
                locale="pt-br"
                allDaySlot={false}
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                slotDuration={'01:00:00'} // Slots de uma hora
                slotLabelFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  omitZeroMinute: false,
                  meridiem: 'short'
                }}
                height="auto"
                eventClick={handleEventClick}
                eventContent={renderEventContent}
                eventClassNames={getEventClassNames}
                datesSet={handleDatesSet}
                // Estilização customizada para slots vazios
                eventDidMount={(info) => {
                  if (info.event.extendedProps.isEmptySlot) {
                    info.el.style.backgroundColor = 'hsl(var(--muted)/0.3)'; // Fundo claro para slots vazios
                    info.el.style.borderColor = 'hsl(var(--border))';
                    info.el.style.color = 'hsl(var(--muted-foreground))';
                    info.el.style.borderStyle = 'dashed';
                    info.el.style.opacity = '0.7';
                  }
                }}
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