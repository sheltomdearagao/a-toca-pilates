import React from 'react';
import { DialogDescription } from '@/components/ui/dialog';
import { format, parseISO, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { ClassEvent } from '@/types/schedule';
import { EnrollmentType } from '@/types/student';

interface ClassInfoDisplayProps {
  classEvent: Partial<ClassEvent> | null;
}

const ClassInfoDisplay = ({ classEvent }: ClassInfoDisplayProps) => {
  if (!classEvent) return null;

  // Extrair enrollment_type de forma segura (fallback caso não exista)
  const enrollmentType = (classEvent.students as { enrollment_type?: EnrollmentType } | undefined)?.enrollment_type;
  const enrollmentCode = enrollmentType === 'Wellhub' ? 'G' : enrollmentType === 'TotalPass' ? 'T' : 'P';
  const title = (classEvent as any).students?.name ? `Aula com ${(classEvent as any).students.name}` : classEvent.title;

  // Duração fixa em 60 minutos, mas usamos o valor do evento se existir (para compatibilidade)
  const durationMinutes = classEvent.duration_minutes || 60;

  // Calcular o end_time com base em start_time e duration_minutes
  const startTime = classEvent.start_time ? parseISO(classEvent.start_time) : null;
  const endTime = startTime ? addMinutes(startTime, durationMinutes) : null;

  // Cor opcional baseada no enrollment_type
  const colorDot = enrollmentCode === 'G' ? 'text-blue-600' : enrollmentCode === 'T' ? 'text-green-600' : 'text-yellow-600';

  return (
    <>
      <h2 className="text-2xl font-bold">
        {title}
        {enrollmentType && (
          <span className={`ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full ${colorDot} bg-white/40`}>
            {enrollmentCode}
          </span>
        )}
      </h2>
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