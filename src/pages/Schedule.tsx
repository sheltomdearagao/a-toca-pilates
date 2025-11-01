import { useState, useMemo, useCallback, memo } from 'react';
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, ChevronLeft, ChevronRight, Loader2, Repeat } from 'lucide-react';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import ClassDetailsDialog from '@/components/schedule/ClassDetailsDialog';
import AddRecurringClassTemplateDialog from '@/components/schedule/AddRecurringClassTemplateDialog';
import RecurringTemplatesList from '@/components/schedule/RecurringTemplatesList';
import { ClassEvent, RecurringClassTemplate } from '@/types/schedule';
import { StudentOption } from '@/types/student';
import { useAppSettings } from '@/hooks/useAppSettings';
import ColoredSeparator from "@/components/ColoredSeparator";
import { parseISO, format, addDays, startOfDay, endOfDay, startOfWeek, isToday, isWeekend, addWeeks, subWeeks, setMinutes, setHours } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';

// Horários reduzidos: 7h às 20h (14 horas, apenas horas cheias)
const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const MAX_CLASSES_PER_LOAD = 150; // Aumentando o limite para cobrir 1-2 semanas de forma mais segura

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
  return (data as any[] || []);
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

  // Novo: cor por tipo de matrícula
  const enrollmentType = classEvent?.students?.enrollment_type;
  const enrollmentCode = enrollmentType === 'Wellhub' ? 'G' : enrollmentType === 'TotalPass' ? 'T' : 'P';
  const colorClass = enrollmentType === 'Wellhub' ? 'bg-blue-600' : enrollmentType === 'TotalPass' ? 'bg-green-600' : 'bg-yellow-500';
  
  // Duração fixa de 60 minutos
  // Event title pode vir com nome do aluno (se houver)
  const eventTitle = classEvent?.students?.name ?? classEvent?.title ?? '';

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
            "p-2 rounded text-xs transition-all hover:scale-[1.02] shadow-md h-full flex flex-col justify-center absolute inset-0",
            colorClass, "text-white"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold truncate">{eventTitle}</span>
            <span className="ml-2 text-xs rounded-full bg-white text-black px-1">{enrollmentCode}</span>
          </div>
          <div className="text-[10px] opacity-90">{attendeeCount}/{classCapacity} alunos (60 min)</div>
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

const Schedule = () => {
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const classCapacity = appSettings?.class_capacity ?? 10;

  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassEvent | null>(null);
  const [quickAddSlot, setQuickAddSlot] = useState<{ date: Date; hour: number } | null>(null);

  const weekEnd = addDays(currentWeekStart, 6);

  const { data: classes, isLoading: isLoadingClasses } = useQuery<ClassEvent[]>({
    queryKey: ['classes', format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: () => fetchClasses(startOfDay(currentWeekStart).toISOString(), endOfDay(weekEnd).toISOString()),
    staleTime: 1000 * 60 * 1,
  });

  const groupedClasses = useMemo(() => {
    return classes ? groupClassesBySlot(classes) : {};
  }, [classes]);

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const handlePreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));

  const handleCellClick = useCallback((date: Date, hour: number) => {
    setQuickAddSlot({ date, hour });
    setIsAddClassOpen(true);
  }, []);

  const handleClassClick = useCallback((classEvent: ClassEvent) => {
    setSelectedClass(classEvent);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedClass(null);
  }, []);

  const handleOpenAddClass = useCallback(() => {
    setQuickAddSlot(null);
    setIsAddClassOpen(true);
  }, []);

  if (isLoadingSettings) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Agenda Semanal</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAddRecurringOpen(true)}>
            <Repeat className="w-4 h-4 mr-2" />
            Agendar Recorrência
          </Button>
          <Button onClick={handleOpenAddClass}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Agendar Aula
          </Button>
        </div>
      </div>

      <ColoredSeparator color="primary" />

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
                      onClassClick={handleClassClick}
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

      <RecurringTemplatesList />

      <AddClassDialog
        isOpen={isAddClassOpen}
        onOpenChange={setIsAddClassOpen}
        quickAddSlot={quickAddSlot}
      />

      <ClassDetailsDialog
        isOpen={!!selectedClass}
        onOpenChange={handleCloseDetails}
        classEvent={selectedClass}
        classCapacity={classCapacity}
      />

      <AddRecurringClassTemplateDialog
        isOpen={isAddRecurringOpen}
        onOpenChange={setIsAddRecurringOpen}
      />
    </div>
  );
};

export default Schedule;