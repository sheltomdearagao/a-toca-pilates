import { useState, useMemo, useCallback, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import ClassDetailsDialog from '@/components/schedule/ClassDetailsDialog';
import AddRecurringClassTemplateDialog from '@/components/schedule/AddRecurringClassTemplateDialog'; // Importar novo componente
import { ClassEvent } from '@/types/schedule';
import { StudentOption } from '@/types/student';
import { useAppSettings } from '@/hooks/useAppSettings';
import ColoredSeparator from "@/components/ColoredSeparator";
import { parseISO, format, addDays, startOfDay, endOfDay, startOfWeek, isToday, isWeekend, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Horários reduzidos: 7h às 20h (14 slots)
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const MAX_CLASSES_PER_LOAD = 15; // Limite agressivo para garantir carregamento rápido

const fetchClasses = async (start: string, end: string): Promise<ClassEvent[]> => {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id, title, start_time, duration_minutes, student_id,
      students(name),
      class_attendees(count)
    `)
    .gte('start_time', start)
    .lte('start_time', end)
    .order('start_time', { ascending: true })
    .limit(MAX_CLASSES_PER_LOAD);
  
  if (error) throw new Error(error.message);
  return (data as any[] || []);
};

const fetchAllStudents = async (): Promise<StudentOption[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, enrollment_type')
    .order('name');
  if (error) throw new Error(error.message);
  return data || [];
};

// Componente memoizado para célula da grade
const ScheduleCell = memo(({ day, hour, classesInSlot, onCellClick, onClassClick, classCapacity }: { day: Date; hour: number; classesInSlot: ClassEvent[]; onCellClick: (day: Date, hour: number) => void; onClassClick: (classEvent: ClassEvent) => void; classCapacity: number; }) => {
  const hasClass = classesInSlot.length > 0;
  const classEvent = classesInSlot[0]; // Lógica de UMA aula por slot
  const attendeeCount = classEvent?.class_attendees[0]?.count ?? 0;
  const eventTitle = classEvent?.student_id && classEvent?.students ? `${classEvent.students.name}` : classEvent?.title || 'Aula';

  return (
    <div className={cn("p-1 border-r min-h-[50px] transition-colors cursor-pointer", isToday(day) ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30", !hasClass && "hover:bg-primary/10")} onClick={() => onCellClick(day, hour)}>
      {hasClass ? (
        <div onClick={(e) => { e.stopPropagation(); onClassClick(classEvent); }} className={cn("p-2 rounded text-xs transition-all hover:scale-[1.02] shadow-sm h-full flex flex-col justify-center", attendeeCount >= classCapacity ? 'bg-destructive text-white' : attendeeCount >= classCapacity - 3 ? 'bg-accent text-accent-foreground' : 'bg-primary text-white')}>
          <div className="font-semibold truncate">{eventTitle}</div>
          <div className="text-[10px] opacity-90">{attendeeCount}/{classCapacity} alunos</div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-xs text-muted-foreground opacity-50"><div className="text-center"><div className="text-sm">+</div></div></div>
      )}
    </div>
  );
});
ScheduleCell.displayName = 'ScheduleCell';

const Schedule = () => {
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isRecurringFormOpen, setIsRecurringFormOpen] = useState(false); // Novo estado
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Partial<ClassEvent> | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'twoWeeks'>('week');
  const [quickAddSlot, setQuickAddSlot] = useState<{ date: Date; hour: number } | null>(null);

  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const CLASS_CAPACITY = appSettings?.class_capacity ?? 10;

  // Pré-carregamento da lista de alunos para agilizar a abertura dos diálogos
  useQuery({ queryKey: ['allStudents'], queryFn: fetchAllStudents, staleTime: 1000 * 60 * 15 });

  const daysToDisplay = useMemo(() => {
    if (viewMode === 'day') return [currentDate];
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    if (viewMode === 'week') return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
    return Array.from({ length: 10 }, (_, i) => addDays(weekStart, i)).filter(day => !isWeekend(day));
  }, [currentDate, viewMode]);

  const dateRange = useMemo(() => {
    const start = startOfDay(daysToDisplay[0]).toISOString();
    const end = endOfDay(daysToDisplay[daysToDisplay.length - 1]).toISOString();
    return { start, end };
  }, [daysToDisplay]);

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes', dateRange.start, dateRange.end],
    queryFn: () => fetchClasses(dateRange.start, dateRange.end),
    staleTime: 1000 * 60 * 3,
  });

  const classesBySlot = useMemo(() => {
    if (!classes) return new Map<string, ClassEvent[]>();
    const map = new Map<string, ClassEvent[]>();
    for (const classEvent of classes) {
      const classStart = parseISO(classEvent.start_time);
      const hour = classStart.getHours();
      const dayKey = format(classStart, 'yyyy-MM-dd');
      const slotKey = `${dayKey}-${hour.toString().padStart(2, '0')}`;
      if (!map.has(slotKey)) map.set(slotKey, [classEvent]);
    }
    return map;
  }, [classes]);

  const isLoading = isLoadingSettings || isLoadingClasses;

  const handleNavigation = useCallback((direction: 'prev' | 'next' | 'today') => {
    setCurrentDate(prev => {
      if (direction === 'today') return new Date();
      const increment = direction === 'prev' ? -1 : 1;
      if (viewMode === 'day') {
        let newDate = addDays(prev, increment);
        while (isWeekend(newDate)) newDate = addDays(newDate, increment);
        return newDate;
      }
      const weeks = viewMode === 'week' ? 1 : 2;
      return addWeeks(prev, weeks * increment);
    });
  }, [viewMode]);

  const handleViewModeChange = useCallback((newMode: 'day' | 'week' | 'twoWeeks') => {
    setViewMode(newMode);
    setCurrentDate(new Date());
  }, []);

  const handleClassClick = useCallback((classEvent: ClassEvent) => {
    setSelectedEvent(classEvent);
    setIsDetailsOpen(true);
  }, []);

  const handleCellClick = useCallback((day: Date, hour: number) => {
    const slotKey = `${format(day, 'yyyy-MM-dd')}-${hour.toString().padStart(2, '0')}`;
    if (!classesBySlot.get(slotKey)) {
      setQuickAddSlot({ date: day, hour });
      setIsAddFormOpen(true);
    }
  }, [classesBySlot]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Agenda de Aulas</h1>
        <div className="flex gap-2">
          <Button onClick={() => { setQuickAddSlot(null); setIsAddFormOpen(true); }}>
            <PlusCircle className="w-4 h-4 mr-2" />Agendar Aula
          </Button>
          <Button variant="outline" onClick={() => setIsRecurringFormOpen(true)}>
            <PlusCircle className="w-4 h-4 mr-2" />Agendar Recorrência
          </Button>
        </div>
      </div>
      <ColoredSeparator color="primary" className="my-6" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => handleNavigation('prev')}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={() => handleNavigation('today')}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => handleNavigation('next')}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <h2 className="text-xl font-semibold">
          {viewMode === 'day' ? format(daysToDisplay[0], "EEEE, dd 'de' MMMM", { locale: ptBR }) : `${format(daysToDisplay[0], 'dd/MM')} - ${format(daysToDisplay[daysToDisplay.length - 1], 'dd/MM')}`}
        </h2>
        <div className="flex gap-2">
          <Button variant={viewMode === 'day' ? 'default' : 'outline'} onClick={() => handleViewModeChange('day')}>Dia</Button>
          <Button variant={viewMode === 'week' ? 'default' : 'outline'} onClick={() => handleViewModeChange('week')}>Semana</Button>
          <Button variant={viewMode === 'twoWeeks' ? 'default' : 'outline'} onClick={() => handleViewModeChange('twoWeeks')}>15 Dias</Button>
        </div>
      </div>
      <Card className="flex-1 overflow-auto shadow-subtle-glow">
        <div className="min-w-max">
          <div className="grid sticky top-0 bg-card z-10 border-b" style={{ gridTemplateColumns: `80px repeat(${daysToDisplay.length}, 1fr)` }}>
            <div className="p-2 border-r font-semibold">Horário</div>
            {daysToDisplay.map(day => (
              <div key={day.toISOString()} className={cn("p-2 text-center border-r font-semibold", isToday(day) && "bg-primary/10 border-primary/50")}>
                <div>{format(day, 'EEE', { locale: ptBR })}</div>
                <div className="text-sm text-muted-foreground">{format(day, 'dd/MM')}</div>
              </div>
            ))}
          </div>
          {isLoading ? (
            HOURS.map(hour => (
              <div key={hour} className="grid border-b" style={{ gridTemplateColumns: `80px repeat(${daysToDisplay.length}, 1fr)` }}>
                <div className="p-2 border-r"><Skeleton className="h-5 w-12" /></div>
                {daysToDisplay.map(day => (<div key={day.toISOString()} className="p-1 border-r min-h-[50px]"><Skeleton className="h-full w-full rounded-md" /></div>))}
              </div>
            ))
          ) : (
            HOURS.map(hour => (
              <div key={hour} className="grid border-b" style={{ gridTemplateColumns: `80px repeat(${daysToDisplay.length}, 1fr)` }}>
                <div className="p-2 border-r text-sm font-medium text-muted-foreground">{`${hour}:00`}</div>
                {daysToDisplay.map(day => {
                  const slotKey = `${format(day, 'yyyy-MM-dd')}-${hour.toString().padStart(2, '0')}`;
                  const classesInSlot = classesBySlot.get(slotKey) || [];
                  return <ScheduleCell key={day.toISOString()} day={day} hour={hour} classesInSlot={classesInSlot} onCellClick={handleCellClick} onClassClick={handleClassClick} classCapacity={CLASS_CAPACITY} />;
                })}
              </div>
            ))
          )}
        </div>
      </Card>
      <AddClassDialog isOpen={isAddFormOpen} onOpenChange={(open) => { setIsAddFormOpen(open); if (!open) setQuickAddSlot(null); }} quickAddSlot={quickAddSlot} />
      <AddRecurringClassTemplateDialog isOpen={isRecurringFormOpen} onOpenChange={setIsRecurringFormOpen} /> {/* Novo diálogo */}
      <ClassDetailsDialog isOpen={isDetailsOpen} onOpenChange={setIsDetailsOpen} classEvent={selectedEvent} classCapacity={CLASS_CAPACITY} />
    </div>
  );
};

export default Schedule;