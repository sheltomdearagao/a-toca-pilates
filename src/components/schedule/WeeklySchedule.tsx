import React, { useState, useMemo, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { ClassEvent } from '@/types/schedule';
import { useAppSettings } from '@/hooks/useAppSettings';
import { parseISO, format, addDays, startOfDay, endOfDay, startOfWeek, isToday, isWeekend, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Horários reduzidos: 7h às 20h (14 horas, apenas horas cheias)
const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const MAX_CLASSES_PER_LOAD = 200;

const fetchClasses = async (start: string, end: string): Promise<ClassEvent[]> => {
  console.log('🔍 Fetching classes from', start, 'to', end);
  
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id, title, start_time, duration_minutes, student_id, recurring_class_template_id,
      students(name),
      class_attendees(count, students(name))
    `)
    .gte('start_time', start)
    .lte('start_time', end)
    .order('start_time', { ascending: true })
    .limit(MAX_CLASSES_PER_LOAD);
  
  if (error) {
    console.error('❌ Error fetching classes:', error);
    throw new Error(error.message);
  }
  
  console.log('📊 Raw data received:', data?.length || 0, 'classes');
  
  // Mapeia os dados para incluir a lista de nomes dos participantes ordenados
  const mappedData = (data as any[] || []).map(cls => {
    const attendeeCount = cls.class_attendees?.[0]?.count ?? 0;
    const attendeeNames = (cls.class_attendees as any[] || [])
      .filter(a => a.students?.name)
      .map(a => a.students.name)
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })); // Ordenação alfabética

    return {
      ...cls,
      attendee_names: attendeeNames,
      class_attendees: [{ count: attendeeCount }], // Mantém a contagem para compatibilidade
    } as ClassEvent;
  });
  
  console.log('✅ Mapped data:', mappedData.length, 'classes with attendees');
  return mappedData;
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
  const dayKey = format(startOfDay(day), 'yyyy-MM-dd');
  const hourKey = hour.toString().padStart(2, '0');
  const slotKey = `${dayKey}-${hourKey}`;
  
  // DEBUG: Log para cada slot
  console.log(`📍 Slot ${slotKey}:`, classesInSlot?.length || 0, 'classes');
  
  const hasClass = classesInSlot && classesInSlot.length > 0;
  const classEvent = hasClass ? classesInSlot[0] : null;
  const attendeeCount = classEvent?.class_attendees?.[0]?.count ?? 0;
  const attendeeNames = classEvent?.attendee_names ?? [];

  // Nova lógica de cores baseada na lotação
  let colorClass = 'bg-primary'; // Cor padrão
  const textColorClass = 'text-white';

  if (attendeeCount >= 1 && attendeeCount <= 5) {
    colorClass = 'bg-green-600';
  } else if (attendeeCount >= 6 && attendeeCount <= 9) {
    colorClass = 'bg-yellow-500';
  } else if (attendeeCount >= 10) {
    colorClass = 'bg-red-600';
  }
  
  // Gera o texto dinâmico do card
  const displayText = classEvent?.title || 'Aula';
  
  // Texto para tooltip com todos os nomes
  const tooltipText = attendeeCount > 0 
    ? `${attendeeCount} aluno${attendeeCount > 1 ? 's' : ''}: ${attendeeNames.join(', ')}`
    : 'Aula sem participantes';

  console.log(`🎨 Rendering slot ${slotKey}:`, { hasClass, attendeeCount, displayText });

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
          onClick={(e) => { e.stopPropagation(); onClassClick(classEvent!); }}
          className={cn(
            "p-2 rounded text-xs transition-all hover:scale-[1.02] shadow-md h-full flex flex-col justify-between absolute inset-0 cursor-pointer",
            colorClass, textColorClass
          )}
        >
          <div className="font-semibold truncate leading-tight flex-1 flex items-center">
            {displayText}
          </div>
          <div className="text-[10px] opacity-90 pt-1 border-t border-white/20">
            {attendeeCount}/{classCapacity} alunos
          </div>
          {/* NOVO: Lista de nomes visível no card */}
          {attendeeNames.length > 0 && (
            <div className="text-[9px] opacity-80 mt-1 truncate">
              {attendeeNames.slice(0, 2).join(', ')}
              {attendeeNames.length > 2 && '...'}
            </div>
          )}
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

interface WeeklyScheduleProps {
  onClassClick: (classEvent: ClassEvent) => void;
  onQuickAdd: (slot: { date: Date; hour: number }) => void;
}

const WeeklySchedule = ({ onClassClick, onQuickAdd }: WeeklyScheduleProps) => {
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const classCapacity = appSettings?.class_capacity ?? 10;

  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = addDays(currentWeekStart, 6);

  const { data: classes, isLoading: isLoadingClasses } = useQuery<ClassEvent[]>({
    queryKey: ['classes', format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: () => fetchClasses(startOfDay(currentWeekStart).toISOString(), endOfDay(weekEnd).toISOString()),
    staleTime: 1000 * 60 * 1,
  });

  const groupedClasses = useMemo(() => {
    console.log('🔄 Grouping classes...');
    const grouped = classes ? groupClassesBySlot(classes) : {};
    console.log('📋 Grouped slots:', Object.keys(grouped).length);
    return grouped;
  }, [classes]);

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const handlePreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));

  const handleCellClick = useCallback((date: Date, hour: number) => {
    console.log('🎯 Quick add clicked:', date, hour);
    onQuickAdd({ date, hour });
  }, [onQuickAdd]);

  if (isLoadingSettings) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  console.log('🗓️ Rendering WeeklySchedule with', daysOfWeek.length, 'days');

  return (
    <Card className="p-4 shadow-impressionist shadow-subtle-glow">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={handlePreviousWeek}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">
          {format(currentWeekStart, 'dd/MM', { locale: ptBR })} - {format(weekEnd, 'dd/MM/yyyy', { locale: ptBR })}
        </h2>
        <Button variant="ghost" size="icon" onClick={handleNextWeek}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-8 min-w-[1000px]">
          {/* Cabeçalho dos dias */}
          <div className="p-2 font-semibold text-sm border-b border-r bg-muted/50">Hora</div>
          {daysOfWeek.map(day => (
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
              <div className="p-2 font-medium text-sm border-r border-b bg-muted/50 flex items-center justify-center">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {daysOfWeek.map(day => {
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
      {isLoadingClasses && <div className="text-center py-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> Carregando aulas...</div>}
    </Card>
  );
};

export default WeeklySchedule;