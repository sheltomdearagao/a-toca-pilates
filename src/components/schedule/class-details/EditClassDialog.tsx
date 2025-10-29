import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { ClassEvent } from '@/types/schedule';
import { Loader2 } from 'lucide-react';
import ClassEditForm from './ClassEditForm';

interface EditClassDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classEvent: ClassEvent | null;
}

const EditClassDialog = ({ isOpen, onOpenChange, classEvent }: EditClassDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (data: any) => {
    if (!classEvent?.id) {
      showError('Aula inválida para edição.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // Build new start_time from date/time
      const dateParts = data.date.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      const baseDate = new Date(year, month, day);
      const [hh] = data.time.split(':');
      const dt = new Date(baseDate);
      dt.setHours(parseInt(hh || '0', 10), 0, 0, 0);
      const startUtc = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString();

      // Update class
      await supabase.from('classes').update({
        title: data.title || null,
        start_time: startUtc,
        duration_minutes: 60,
        notes: data.notes ?? null,
        student_id: data.student_id?.length === 1 ? data.student_id[0] : null
      }).eq('id', classEvent.id);

      // Update attendees (remove all and add new if provided)
      await supabase.from('class_attendees').delete().eq('class_id', classEvent.id);
      if (data.student_id && data.student_id.length > 0) {
        const sid = data.student_id.length === 1 ? data.student_id[0] : null;
        if (sid) {
          await supabase.from('class_attendees').insert([
            { user_id: user.id, class_id: classEvent.id, student_id: sid, status: 'Agendado' }
          ]);
        }
      }

      showSuccess('Aula atualizada com sucesso!');
      onOpenChange(false);
    } catch (err: any) {
      showError(err?.message || 'Erro ao editar aula.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <ClassEditForm
          classEvent={classEvent ?? null}
          allStudents={undefined}
          isLoadingAllStudents={false}
          onSubmit={onSubmit}
          onCancelEdit={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EditClassDialog;