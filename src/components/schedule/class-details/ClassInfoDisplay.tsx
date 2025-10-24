import React from 'react';
import { DialogDescription } from '@/components/ui/dialog';
import { format, parseISO, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { ClassEvent } from '@/types/schedule';

interface ClassInfoDisplayProps {
  classEvent: Partial<ClassEvent> | null;
}

const ClassInfoDisplay = ({ classEvent }: ClassInfoDisplayProps) => {
  if (!classEvent) return null;

  const title = classEvent.students?.name ? `Aula com ${classEvent.students.name}` : classEvent.title;

  // Duração fixa em 60 minutos, mas usamos o valor do evento se existir (para compatibilidade)
  const durationMinutes = classEvent.duration_minutes || 60; 

  // Calcular o end_time com base em start_time e duration_minutes
  const startTime = classEvent.start_time ? parseISO(classEvent.start_time) : null;
  const endTime = startTime ? addMinutes(startTime, durationMinutes) : null;

  return (
    <>
      <h2 className="text-2xl font-bold">{title}</h2>
      {startTime && endTime && (
        <DialogDescription>
          {`${format(startTime, "eeee, dd 'de' MMMM", { locale: ptBR })} das ${format(startTime, 'HH:mm')} às ${format(endTime, 'HH:mm')} (${durationMinutes} min)`}
        </DialogDescription>
      )}
      {classEvent.notes && (
        <div className="mt-4 text-sm text-muted-foreground">
          <span className="font-semibold">Notas:</span> {classEvent.notes}
        </div>
      )}
    </>
  );
};

export default ClassInfoDisplay;