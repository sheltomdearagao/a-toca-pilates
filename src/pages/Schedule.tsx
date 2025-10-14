import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import ClassDetailsDialog from '@/components/schedule/ClassDetailsDialog';
import { ClassEvent } from '@/types/schedule';
import { useAppSettings } from '@/hooks/useAppSettings';
import ColoredSeparator from "@/components/ColoredSeparator";
import { parseISO, format, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, isToday, set, isWeekend, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import { fromZonedTime } from 'date-fns-tz';

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const MAX_CLASSES_PER_LOAD = 50; // Limite máximo de aulas por carregamento

const fetchClasses = async (start: string, end: string): Promise<ClassEvent[]> => {
  // Otimização: Buscar apenas campos essenciais e limitar resultados
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
    .order('start_time', { ascending: true })
    .limit(MAX_CLASSES_PER_LOAD); // Limite de aulas carregadas
  
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
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 });
  });
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'twoWeeks'>('week');
  const [quickAddSlot, setQuickAddSlot] = useState<{ date: Date; hour: number } | null>(null);

  const queryClient = useQueryClient();
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const CLASS_CAPACITY = appSettings?.class_capacity ?? 10;

  // Gerar dias para exibir baseado no modo de visualização (otimizado)
  const daysToDisplay = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    
    if (viewMode === 'day') {
      return [weekStart]; // Sempre mostrar segunda-feira para modo dia
    } 
    
    if (viewMode === 'week') {
      return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)); // Seg-Sex
    }
    
    // twoWeeks: máximo 10 dias úteis
    return Array.from({ length: 10 }, (_, i) => addDays(weekStart, i)).filter(day => !isWeekend(day));
  }, [currentDate, viewMode]);

  // Calcular range de datas para a query (otimizado)
  const dateRange = useMemo(() => {
    if (daysToDisplay.length === 0) return { start: '', end: '' };
    
    const start = startOfDay(daysToDisplay[0]).toISOString();
    const end = endOfDay(daysToDisplay[daysToDisplay.length - 1]).toISOString();
    
    return { start, end };
  }, [daysToDisplay]);

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes', dateRange.start, dateRange.end],
    queryFn: () => fetchClasses(dateRange.start, dateRange.end),
    enabled: !!dateRange.start && !!dateRange.end,
    staleTime: 1000 * 60 * 2, // Cache reduzido para 2 minutos
    gcTime: 1000 * 60 * 5, // Garbage collection após 5 minutos
  });

  // Mapa otimizado de aulas por slot horário (usando Map para O(1) lookup)
  const classesBySlot = useMemo(() => {
    if (!classes || classes.length === 0) return new Map<string, ClassEvent[]>();

    const map = new Map<string, ClassEvent[]>();
    
    for (const classEvent of classes) {
      const classStart = parseISO(classEvent.start_time);
      const hour = classStart.getHours();
      const dayKey = format(classStart, 'yyyy-MM-dd');
      const slotKey = `${dayKey}-${hour.toString().padStart(2, '0')}`;
      
      const slotClasses = map.get(slotKey);
      if (slotClasses) {
        slotClasses.push(classEvent);
      } else {
        map.set(slotKey, [classEvent]);
      }
    }
    
    return map;
  }, [classes]);

  const isLoading = isLoadingSettings || isLoadingClasses;

  // Navegação otimizada com useCallback
  const handlePrevious = useCallback(() => {
    setCurrentDate(prev => {
      if (viewMode === 'day') {
        let newDate = addDays(prev, -1);
        while (isWeekend(newDate)) {
          newDate = addDays(newDate, -1);
        }
        return newDate;
      } else {
        const weeksToSubtract = viewMode === 'week' ? 1 : 2;
        return subWeeks(prev, weeksToSubtract);
      }
    });
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setCurrentDate(prev => {
      if (viewMode === 'day') {
        let newDate = addDays(prev, 1);
        while (isWeekend(newDate)) {
          newDate = addDays(newDate, 1);
        }
        return newDate;
      } else {
        const weeksToAdd = viewMode === 'week' ? 1 : 2;
        return addWeeks(prev, weeksToAdd);
      }
    });
  }, [viewMode]);

  const handleToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(startOfWeek(today, { weekStartsOn: 1 }));
  }, []);

  const handleViewModeChange = useCallback((newMode: 'day' | 'week' | 'twoWeeks') => {
    setViewMode(newMode);
  }, []);

  const handleClassClick = useCallback((classEvent: ClassEvent) => {
    setSelectedEvent({
      id: classEvent.id,
      title: classEvent.title,
      start_time: classEvent.start_time,
      duration_minutes: classEvent.duration_minutes,
      student_id: classEvent.student_id,
    });
    setDetailsOpen(true);
  }, []);

  const handleCellClick = useCallback((day: Date, hour: number) => {
    const slotKey = `${format(day, 'yyyy-MM-dd')}-${hour.toString().padStart(2, '0')}`;
    const classesInSlot = classesBySlot.get(slotKey) || [];
    
    if (classesInSlot.length === 0) {
      setQuickAddSlot({ date: day, hour });
      setAddFormOpen(true);
    }
  }, [classesBySlot]);

  const quickAddMutation = useMutation({
    mutationFn: async ({ date, hour }: { date: Date; hour: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const startDateTime = set(new Date(date), {
        hours: hour,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      });
      
      const startUtc = fromZonedTime(startDateTime, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
      
      const dataToSubmit = {
        user_id: user.id,
        title: 'Nova Aula',
        start_time: startUtc,
        duration_minutes: 60,
        notes: '',
        student_id: null,
      };
      
      const { error } = await supabase.from('classes').insert([dataToSubmit]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Aula agendada com sucesso!');
      setAddFormOpen(false);
      setQuickAddSlot(null);
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  // Componente otimizado para célula da grade
  const ScheduleCell = useMemo(() => {
    return ({ day, hour }: { day: Date; hour: number }) => {
      const slotKey = `${format(day, 'yyyy-MM-dd')}-${hour.toString().padStart(2, '0')}`;
      const classesInSlot = classesBySlot.get(slotKey) || [];

      return (
        <div 
          className={cn(
            "p-1 border-r min-h-[60px] transition-colors cursor-pointer",
            isToday(day) ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30",
            classesInSlot.length === 0 && "hover:bg-primary/10"
          )}
          onClick={() => handleCellClick(day, hour)}
        >
          {classesInSlot.length > 0 ? (
            <div className="space-y-1">
              {classesInSlot.slice(0, 3).map(classEvent => { // Limitar a 3 aulas por célula
                const attendeeCount = classEvent.class_attendees[0]?.count ?? 0;
                const eventTitle = classEvent.student_id && classEvent.students 
                  ? `${classEvent.students.name}` 
                  : classEvent.title || 'Aula';

                return (
                  <div
                    key={classEvent.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClassClick(classEvent);
                    }}
                    className={cn(
                      "p-2 rounded text-xs transition-all hover:scale-[1.02] shadow-sm",
                      attendeeCount >= CLASS_CAPACITY
                        ? 'bg-destructive text-white'
                        : attendeeCount >= CLASS_CAPACITY - 3
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-primary text-white'
                    )}
                  >
                    <div className="font-semibold truncate">{eventTitle}</div>
                    <div className="text-[10px] opacity-90">
                      {attendeeCount}/{CLASS_CAPACITY} alunos
                    </div>
                  </div>
                );
              })}
              {classesInSlot.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{classesInSlot.length - 3} mais
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground opacity-50">
              <div className="text-center">
                <div className="text-lg">+</div>
                <div>Agendar</div>
              </div>
            </div>
          )}
        </div>
      );
    };
  }, [classesBySlot, handleCellClick, handleClassClick, CLASS_CAPACITY]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Agenda de Aulas</h1>
        <Button onClick={() => { setQuickAddSlot(null); setAddFormOpen(true); }}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Agendar Aula
        </Button>
      </div>

      <ColoredSeparator color="primary" className="my-6" />

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
            ? format(daysToDisplay[0], "EEEE, dd 'de' MMMM", { locale: ptBR })
            : `${format(daysToDisplay[0], 'dd/MM')} - ${format(daysToDisplay[daysToDisplay.length - 1], 'dd/MM')}`
          }
        </h2>
        <div className="flex gap-2">
          <Button variant={viewMode === 'day' ? 'default' : 'outline'} onClick={() => handleViewModeChange('day')}>
            Dia
          </Button>
          <Button variant={viewMode === 'week' ? 'default' : 'outline'} onClick={() => handleViewModeChange('week')}>
            Semana
          </Button>
          <Button variant={viewMode === 'twoWeeks' ? 'default' : 'outline'} onClick={() => handleViewModeChange('twoWeeks')}>
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
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "p-2 text-center border-r font-semibold",
                    isToday(day) && "bg-primary/10 border-primary/50"
                  )}
                >
                  <div>{format(day, 'EEE', { locale: ptBR })}</div>
                  <div className="text-sm text-muted-foreground">{format(day, 'dd/MM')}</div>
                </div>
              ))}
            </div>

            {/* Grid de horários - renderização otimizada */}
            {HOURS.map(hour => (
              <div key={hour} className="grid border-b" style={{ gridTemplateColumns: `80px repeat(${daysToDisplay.length}, 1fr)` }}>
                <div className="p-2 border-r text-sm font-medium text-muted-foreground">
                  {`${hour}:00`}
                </div>
                {daysToDisplay.map(day => (
                  <ScheduleCell key={`${day.toISOString()}-${hour}`} day={day} hour={hour} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}
      
      <AddClassDialog 
        isOpen={isAddFormOpen} 
        onOpenChange={(isOpen) => {
          setAddFormOpen(isOpen);
          if (!isOpen) setQuickAddSlot(null);
        }} 
        quickAddSlot={quickAddSlot}
        onQuickAdd={(date, hour) => quickAddMutation.mutate({ date, hour })}
      />
      <ClassDetailsDialog isOpen={isDetailsOpen} onOpenChange={setDetailsOpen} classEvent={selectedEvent} classCapacity={CLASS_CAPACITY} />
    </div>
  );
};

export default Schedule;