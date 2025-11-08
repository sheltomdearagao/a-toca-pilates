import React, { useState, useMemo, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { ClassEvent } from '@/types/schedule';
import { useAppSettings } from '@/hooks/useAppSettings';
import { parseISO, format, addDays, startOfDay, endOfDay, subDays, isToday, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Horários reduzidos: 7h às 20h (14 horas, apenas horas cheias)
const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAYS_IN_PERIOD = 14;
const MAX_CLASSES_PER_LOAD = 300;

const fetchClasses = async (start: string, end: string): Promise<ClassEvent[]> => {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id, title, start_time, duration_minutes, student_id, recurring_class_template_id,
      students(name, enrollment_type),
      class_attendees(count)
    `)
    .gte('start_time', start)
    .lte('start_time', end)
    .order('start_time', { ascending: true })
    .limit(MAX_CLASSES_PER_LOAD);
  
  if (error) throw new Error(error.message);
  return data as unknown as ClassEvent[];
};

// Função auxiliar para agrupar aulas por dia e hora
const groupClassesBySlot = (classes: ClassEvent[]) => {
  const grouped: Record<string, ClassEvent[]> = {};
  classes.forEach(cls => {
    const startTime = parseISO(cls.start_time);
    const dayKey = format(startOfDay(startTime), 'yyyy-MM-dd');
    const hourKey = format(startTime, 'HH');
    const key = `${dayKey}-${hourKey}`;
    
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(cls);
  });
  return grouped;
};

const ScheduleCell = memo(({ day, hour, classesInSlot, onCellClick, onClassClick, classCapacity }: { day: Date; hour: number; classesInSlot: ClassEvent[]; onCellClick: (day: Date, hour: number) => void; onClassClick: (classEvent: ClassEvent) => void; classCapacity: number; }) => {
  const hasClass = classesInSlot.length > 0;
  const classEvent = classesInSlot[0]; // Lógica de UMA aula por slot
  const attendeeCount = classEvent?.class_attendees?.[0]?.count ?? 0;

  let colorClass = 'bg-primary';
  const textColorClass = 'text-white';

  if (attendeeCount >= 1 && attendeeCount <= 5) {
    colorClass = 'bg-green-600';
  } else if (attendeeCount >= 6 && attendeeCount <= 9) {
    colorClass = 'bg-yellow-500';
  } else if (attendeeCount >= 10) {
    colorClass = 'bg-red-600';
  }

  return (
    <div
      className={cn(
        "p-1 border-r border-b relative transition-colors",
        isToday(day) ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30",
        !hasClass && "hover:bg-primary/10",
        hasClass ? "z-10" : "z-0"
      )}
      style={{ height: '100px' }}
      onClick={() => onCellClick(day, hour)}
    >
      {hasClass ? (
        <div
          onClick={(e) => { e.stopPropagation(); onClassClick(classEvent); }}
          className={cn(
            "p-2 rounded text-xs transition-all hover:scale-[1.02] shadow-md h-full flex flex-col justify-between absolute inset-0 cursor-pointer",
            colorClass, textColorClass
          )}
        >
          <div className="font-semibold truncate leading-tight flex-1 flex items-center">
            {attendeeCount}/{classCapacity} alunos
          </div>
          <div className="text-[10px] opacity-90 pt-1 border-t border-white/20">
            60 min
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-xs text-muted-foreground opacity-50">
          <div className="text-center"><div className="text-sm">+</div></div>
        </div>
      )}
    </div>
  );
});
ScheduleCell.displayName = 'ScheduleCell';

interface BiWeeklyScheduleProps {
  onClassClick: (classEvent: ClassEvent) => void;
  onQuickAdd: (slot: { date: Date; hour: number }) => void;
}

const BiWeeklySchedule = ({ onClassClick, onQuickAdd }: BiWeeklyScheduleProps) => {
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const classCapacity = appSettings?.class_capacity ?? 10;

  const [currentStart, setCurrentStart] = useState(startOfDay(new Date()));
  const periodEnd = addDays(currentStart, DAYS_IN_PERIOD - 1);

  const { data: classes, isLoading: isLoadingClasses } = useQuery<ClassEvent[]>({
    queryKey: ['classes', format(currentStart, 'yyyy-MM-dd'), DAYS_IN_PERIOD],
    queryFn: () => fetchClasses(currentStart.toISOString(), endOfDay(periodEnd).toISOString()),
    staleTime: 1000 * 60 * 1,
  });

  const groupedClasses = useMemo(() => {
    return classes ? groupClassesBySlot(classes) : {};
  }, [classes]);

  const daysInPeriod = useMemo(() => {
    return Array.from({ length: DAYS_IN_PERIOD }, (_, i) => addDays(currentStart, i));
  }, [currentStart]);

  const handlePrevious = () => setCurrentStart(subDays(currentStart, DAYS_IN_PERIOD));
  const handleNext = () => setCurrentStart(addDays(currentStart, DAYS_IN_PERIOD));

  const handleCellClick = useCallback((date: Date, hour: number) => {
    onQuickAdd({ date, hour });
  }, [onQuickAdd]);

  if (isLoadingSettings) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="p-4 shadow-impressionist shadow-subtle-glow">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={handlePrevious}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">
          {format(currentStart, 'dd/MM', { locale: ptBR })} - {format(periodEnd, 'dd/MM/yyyy', { locale: ptBR })}
        </h2>
        <Button variant="ghost" size="icon" onClick={handleNext}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea className="h-[60vh]">
        <div className="overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `80px repeat(${DAYS_IN_PERIOD}, minmax(100px, 1fr))` }}>
            {/* Cabeçalho dos dias */}
            <div className="p-2 font-semibold text-sm border-b border-r bg-muted/50 sticky left-0 z-20">Hora</div>
            {daysInPeriod.map(day => (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-2 font-semibold text-sm border-b border-r text-center",
                  isToday(day) ? "bg-primary/10 text-primary" : "bg-muted/50",
                  isWeekend(day) && "text-muted-foreground"
                )}
              >
                {format(day, 'EEE', { locale: ptBR })} <span className="font-normal text-xs block">{format(day, 'dd/MM')}</span>
              </div>
            ))}

            {/* Slots de Horário */}
            {HOURS.map(hour => (
              <React.Fragment key={hour}>
                <div className="p-2 font-medium text-sm border-r border-b bg-muted/50 flex items-center justify-center sticky left-0 z-10">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {daysInPeriod.map(day => {
                  const dayKey = format(startOfDay(day), 'yyyy-MM-dd');
                  const hourKey = hour.toString().padStart(2, '0');
                  const slotKey = `${dayKey}-${hourKey}`;
                  const classesInSlot = groupedClasses[slotKey] || [];
                  
                  return (
                    <ScheduleCell
                      key={slotKey}
                      day={day}
                      hour={hour}
                      classesInSlot={classesInSlot}
                      onCellClick={handleCellClick}
                      onClassClick={onClassClick}
                      classCapacity={classCapacity}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </ScrollArea>
      {isLoadingClasses && <div className="text-center py-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> Carregando aulas...</div>}
    </Card>
  );
};

export default BiWeeklySchedule;