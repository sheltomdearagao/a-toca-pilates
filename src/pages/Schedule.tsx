import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Repeat } from 'lucide-react';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import ClassDetailsDialog from '@/components/schedule/ClassDetailsDialog';
import AddRecurringClassTemplateDialog from '@/components/schedule/AddRecurringClassTemplateDialog';
import RecurringTemplatesList from '@/components/schedule/RecurringTemplatesList';
import { ClassEvent } from '@/types/schedule';
import { ColoredSeparator } from "@/components/ColoredSeparator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Importando os novos componentes de visualização
import WeeklySchedule from '@/components/schedule/WeeklySchedule';
import DailySchedule from '@/components/schedule/DailySchedule';
import BiWeeklySchedule from '@/components/schedule/BiWeeklySchedule';

const Schedule = () => {
  const [view, setView] = useState<'weekly' | 'daily' | 'biweekly'>('weekly');
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassEvent | null>(null);
  const [quickAddSlot, setQuickAddSlot] = useState<{ date: Date; hour: number } | null>(null);

  const handleClassClick = useCallback((classEvent: ClassEvent) => {
    setSelectedClass(classEvent);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedClass(null);
  }, []);

  const handleQuickAdd = useCallback((slot: { date: Date; hour: number }) => {
    setQuickAddSlot(slot);
    setIsAddClassOpen(true);
  }, []);

  const handleOpenAddClass = useCallback(() => {
    setQuickAddSlot(null);
    setIsAddClassOpen(true);
  }, []);

  const renderScheduleView = () => {
    const commonProps = {
      onClassClick: handleClassClick,
      onQuickAdd: handleQuickAdd,
    };

    switch (view) {
      case 'daily':
        return <DailySchedule {...commonProps} />;
      case 'biweekly':
        return <BiWeeklySchedule {...commonProps} />;
      case 'weekly':
      default:
        return <WeeklySchedule {...commonProps} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Agenda</h1>
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

      <Tabs value={view} onValueChange={(v) => setView(v as 'weekly' | 'daily' | 'biweekly')}>
        <TabsList className="mb-4">
          <TabsTrigger value="weekly">Semanal</TabsTrigger>
          <TabsTrigger value="daily">Diária</TabsTrigger>
          <TabsTrigger value="biweekly">Quinzenal</TabsTrigger>
        </TabsList>
        
        <TabsContent value="weekly" className="mt-0">
          {renderScheduleView()}
        </TabsContent>
        <TabsContent value="daily" className="mt-0">
          {renderScheduleView()}
        </TabsContent>
        <TabsContent value="biweekly" className="mt-0">
          {renderScheduleView()}
        </TabsContent>
      </Tabs>

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
        classCapacity={10} // Capacidade padrão, será ajustada pelo useAppSettings dentro do componente
      />

      <AddRecurringClassTemplateDialog
        isOpen={isAddRecurringOpen}
        onOpenChange={setIsAddRecurringOpen}
      />
    </div>
  );
};

export default Schedule;