import React, { useState, useMemo, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, Clock } from 'lucide-react';
import { ClassEvent } from '@/types/schedule';
import { useAppSettings } from '@/hooks/useAppSettings';
import { parseISO, format, addDays, startOfDay, endOfDay, subDays, isToday, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Horários reduzidos: 7h às 20h (14 horas, apenas horas cheias)
const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const MAX_CLASSES_PER_LOAD = 50;

const fetchClassesForDay = async (day: Date): Promise<ClassEvent[]> => {
  const start = startOfDay(day).toISOString();
  const end = endOfDay(day).toISOString();

  const { data, error } = await supabase
    .from('classes')
    .select(`
      id, title, start_time, duration_minutes, student_id, recurring_class_template_id,
      students(name, enrollment_type),
      class_attendees(count, students(name))
    `)
    .gte('start_time', start)
    .lte('start_time', end)
    .order('start_time', { ascending: true })
    .limit(MAX_CLASSES_PER_LOAD);
  
  if (error) throw new Error(error.message);
  return (data as any[] || []);
};

interface DailyScheduleProps {
  onClassClick: (classEvent: ClassEvent) => void;
  onQuickAdd: (slot: { date: Date; hour: number }) => void;
}

const DailySchedule = ({ onClassClick, onQuickAdd }: DailyScheduleProps) => {
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const classCapacity = appSettings?.class_capacity ?? 10;

  const [currentDay, setCurrentDay] = useState(new Date());

  const { data: classes, isLoading: isLoadingClasses } = useQuery<ClassEvent[]>({
    queryKey: ['classes', format(currentDay, 'yyyy-MM-dd')],
    queryFn: () => fetchClassesForDay(currentDay),
    staleTime: 1000 * 60 * 1,
  });

  const groupedClasses = useMemo(() => {
    const grouped: Record<string, ClassEvent[]> = {};
    classes?.forEach(cls => {
      const startTime = parseISO(cls.start_time);
      const hourKey = format(startTime, 'HH');
      if (!grouped[hourKey]) grouped[hourKey] = [];
      grouped[hourKey].push(cls);
    });
    return grouped;
  }, [classes]);

  const handlePreviousDay = () => setCurrentDay(subDays(currentDay, 1));
  const handleNextDay = () => setCurrentDay(addDays(currentDay, 1));

  const handleCellClick = useCallback((hour: number) => {
    onQuickAdd({ date: currentDay, hour });
  }, [currentDay, onQuickAdd]);

  if (isLoadingSettings) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="p-4 shadow-impressionist shadow-subtle-glow">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={handlePreviousDay}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className={cn("text-xl font-semibold", isToday(currentDay) ? "text-primary" : isPast(currentDay) ? "text-muted-foreground" : "text-foreground")}>
          {format(currentDay, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </h2>
        <Button variant="ghost" size="icon" onClick={handleNextDay}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea className="h-[60vh]">
        <div className="grid grid-cols-[80px_1fr] border-t border-l">
          {HOURS.map(hour => {
            const hourKey = hour.toString().padStart(2, '0');
            const classesInSlot = groupedClasses[hourKey] || [];
            const hasClass = classesInSlot.length > 0;

            return (
              <React.Fragment key={hour}>
                {/* Coluna da Hora */}
                <div className="p-2 font-medium text-sm border-r border-b bg-muted/50 flex items-center justify-center">
                  {hourKey}:00
                </div>
                {/* Coluna dos Slots */}
                <div
                  className={cn(
                    "p-2 border-r border-b relative transition-colors min-h-[100px]",
                    isToday(currentDay) ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30",
                    !hasClass && "hover:bg-primary/10",
                  )}
                  onClick={() => handleCellClick(hour)}
                >
                  {hasClass ? (
                    <div className="space-y-2">
                      {classesInSlot.map(cls => {
                        const attendeeCount = cls.class_attendees?.[0]?.count ?? 0;
                        
                        let colorClass = 'bg-primary';
                        if (attendeeCount >= 1 && attendeeCount <= 5) {
                          colorClass = 'bg-green-600';
                        } else if (attendeeCount >= 6 && attendeeCount <= 9) {
                          colorClass = 'bg-yellow-500';
                        } else if (attendeeCount >= 10) {
                          colorClass = 'bg-red-600';
                        }

                        // 1. Extrair e ordenar nomes dos alunos
                        const studentNames = useMemo(() => {
                          if (!cls.class_attendees) return [];
                          
                          const attendees = (cls.class_attendees as any[]).filter(a => a.students && a.students.name);
                          
                          const names = attendees.map(a => {
                            const fullName = a.students.name as string;
                            return fullName.split(' ')[0]; // Pega apenas o primeiro nome
                          }).sort((a, b) => a.localeCompare(b));
                          
                          return names;
                        }, [cls.class_attendees]);

                        return (
                          <div
                            key={cls.id}
                            onClick={(e) => { e.stopPropagation(); onClassClick(cls); }}
                            className={cn(
                              "p-2 rounded text-xs text-white transition-all hover:scale-[1.01] shadow-md flex flex-col",
                              colorClass
                            )}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold truncate">Alunos ({studentNames.length})</span>
                              <Badge variant="secondary" className="text-[10px] font-normal bg-white/20 text-white">
                                {attendeeCount}/{classCapacity}
                              </Badge>
                            </div>
                            
                            {/* Lista de Nomes Rolável */}
                            <div className="max-h-12 overflow-y-auto custom-scrollbar">
                              {studentNames.map((name, index) => (
                                <div key={index} className="truncate leading-tight">
                                  {name}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground opacity-50">
                      <div className="text-center"><div className="text-sm">+</div></div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </ScrollArea>
      {isLoadingClasses && <div className="text-center py-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> Carregando aulas...</div>}
    </Card>
  );
};

export default DailySchedule;