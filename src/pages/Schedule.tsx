import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import ClassDetailsDialog from '@/components/schedule/ClassDetailsDialog';
import RecurringClassTemplatesTab from '@/components/schedule/RecurringClassTemplatesTab';
import { ClassEvent } from '@/types/schedule';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppSettings } from '@/hooks/useAppSettings';
import ColoredSeparator from "@/components/ColoredSeparator";
import { parseISO, format, addMinutes, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

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
    duration_minutes: c.duration_minutes || 60,
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'twoWeeks'>('week');

  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const CLASS_CAPACITY = appSettings?.class_capacity ?? 10;

  // Calcular range de datas baseado no modo de visualização
  const getDateRange = () => {
    if (viewMode === 'day') {
      return {
        start: startOfDay(currentDate).toISOString(),
        end: endOfDay(currentDate).toISOString(),
      };
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return {
        start: startOfDay(weekStart).toISOString(),
        end: endOfDay(weekEnd).toISOString(),
      };
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const twoWeeksEnd = addDays(weekStart, 13);
      return {
        start: startOfDay(weekStart).toISOString(),
        end: endOfDay(twoWeeksEnd).toISOString(),
      };
    }
  };

  const dateRange = getDateRange();

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes', dateRange.start, dateRange.end],
    queryFn: () => fetchClasses(dateRange.start, dateRange.end),
    staleTime: 1000 * 60 * 1,
  });

  const isLoading = isLoadingSettings || isLoadingClasses;

  // Gerar dias para exibir
  const getDaysToDisplay = () => {
    if (viewMode === 'day') {
      return [currentDate];
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)); // Seg-Sex
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 10 }, (_, i) => addDays(weekStart, i)).filter(d => d.getDay() !== 0 && d.getDay() !== 6); // Excluir sáb/dom
    }
  };

  const daysToDisplay = getDaysToDisplay();

  const handlePrevious = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, -1));
    } else if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(addDays(currentDate, -14));
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addDays(currentDate, 14));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getClassesForSlot = (day: Date, hour: number) => {
    return classes?.filter(c => {
      const classStart = parseISO(c.start_time);
      return isSameDay(classStart, day) && classStart.getHours() === hour;
    }) || [];
  };

  const handleClassClick = (classEvent: ClassEvent) => {
    setSelectedEvent({
      id: classEvent.id,
      title: classEvent.title,
      start_time: classEvent.start_time,
      duration_minutes: classEvent.duration_minutes,
      notes: classEvent.notes,
      student_id: classEvent.student_id,
    });
    setDetailsOpen(true);
  };

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
        <TabsContent value="calendar" className="mt-4 flex-1 flex flex-col">
          {/* Controles de navegação */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevious}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={handleToday}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" onClick={handleNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <h2 className="text-xl font-semibold">
              {viewMode === 'day' 
                ? format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
                : `${format(daysToDisplay[0], 'dd/MM')} - ${format(daysToDisplay[daysToDisplay.length - 1], 'dd/MM')}`
              }
            </h2>
            <div className="flex gap-2">
              <Button variant={viewMode === 'day' ? 'default' : 'outline'} onClick={() => setViewMode('day')}>
                Dia
              </Button>
              <Button variant={viewMode === 'week' ? 'default' : 'outline'} onClick={() => setViewMode('week')}>
                Semana
              </Button>
              <Button variant={viewMode === 'twoWeeks' ? 'default' : 'outline'} onClick={() => setViewMode('twoWeeks')}>
                15 Dias
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando agenda...</span>
            </div>
          ) : (
            <Card className="flex-1 overflow-auto shadow-subtle-glow">
              <div className="min-w-max">
                {/* Cabeçalho com dias */}
                <div className="grid sticky top-0 bg-card z-10 border-b" style={{ gridTemplateColumns: `80px repeat(${daysToDisplay.length}, 1fr)` }}>
                  <div className="p-2 border-r font-semibold">Horário</div>
                  {daysToDisplay.map(day => (
                    <div key={day.toISOString()} className="p-2 text-center border-r font-semibold">
                      <div>{format(day, 'EEE', { locale: ptBR })}</div>
                      <div className="text-sm text-muted-foreground">{format(day, 'dd/MM')}</div>
                    </div>
                  ))}
                </div>

                {/* Grid de horários */}
                {HOURS.map(hour => (
                  <div key={hour} className="grid border-b" style={{ gridTemplateColumns: `80px repeat(${daysToDisplay.length}, 1fr)` }}>
                    <div className="p-2 border-r text-sm font-medium text-muted-foreground">
                      {`${hour}:00`}
                    </div>
                    {daysToDisplay.map(day => {
                      const classesInSlot = getClassesForSlot(day, hour);
                      const totalAttendees = classesInSlot.reduce((sum, c) => sum + (c.class_attendees[0]?.count ?? 0), 0);
                      const isFull = totalAttendees >= CLASS_CAPACITY;
                      const isFewSpots = totalAttendees >= CLASS_CAPACITY - 3;

                      return (
                        <div key={`${day.toISOString()}-${hour}`} className="p-1 border-r min-h-[60px] hover:bg-muted/30 transition-colors">
                          {classesInSlot.length > 0 ? (
                            <div className="space-y-1">
                              {classesInSlot.map(classEvent => {
                                const attendeeCount = classEvent.class_attendees[0]?.count ?? 0;
                                const eventTitle = classEvent.student_id && classEvent.students 
                                  ? `${classEvent.students.name}` 
                                  : classEvent.title || 'Aula';

                                return (
                                  <div
                                    key={classEvent.id}
                                    onClick={() => handleClassClick(classEvent)}
                                    className={`p-2 rounded cursor-pointer text-xs transition-all hover:scale-[1.02] ${
                                      attendeeCount >= CLASS_CAPACITY
                                        ? 'bg-destructive text-white'
                                        : attendeeCount >= CLASS_CAPACITY - 3
                                        ? 'bg-accent text-accent-foreground'
                                        : 'bg-primary text-white'
                                    }`}
                                  >
                                    <div className="font-semibold truncate">{eventTitle}</div>
                                    <div className="text-[10px] opacity-90">
                                      {attendeeCount}/{CLASS_CAPACITY} alunos
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground opacity-50">
                              {CLASS_CAPACITY} vagas
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
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