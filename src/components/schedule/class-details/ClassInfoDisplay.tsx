import React from 'react';
import { DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns'; // Não precisa de parseISO aqui, já é Date
import { ptBR } from 'date-fns/locale/pt-BR'; // Corrigido o caminho de importação
import { ClassEvent } from '@/types/schedule';

interface ClassInfoDisplayProps {
  classEvent: Partial<ClassEvent> | null;
}

const ClassInfoDisplay = ({ classEvent }: ClassInfoDisplayProps) => {
  if (!classEvent) return null;

  const title = classEvent.students?.name ? `Aula com ${classEvent.students.name}` : classEvent.title;

  return (
    <>
      <h2 className="text-2xl font-bold">{title}</h2>
      {classEvent.start_time && classEvent.end_time && (
        <DialogDescription>
          {`${format(classEvent.start_time, "eeee, dd 'de' MMMM", { locale: ptBR })} das ${format(classEvent.start_time, 'HH:mm')} às ${format(classEvent.end_time, 'HH:mm')}`}
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