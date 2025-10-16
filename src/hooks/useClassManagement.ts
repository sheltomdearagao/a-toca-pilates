import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { ClassAttendee, AttendanceStatus, ClassEvent } from '@/types/schedule';
import { ClassFormData } from '@/components/schedule/class-details/ClassEditForm';
import { format, set } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { StudentOption } from '@/types/student';

interface UseClassManagementProps {
  classId: string | undefined;
  allStudents: StudentOption[] | undefined;
}

export const useClassManagement = ({ classId, allStudents }: UseClassManagementProps) => {
  const queryClient = useQueryClient();

  const invalidateClassQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['classAttendees', classId] });
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    queryClient.invalidateQueries({ queryKey: ['classDetails', classId] });
  };

  const addAttendeeMutation = useMutation({
    mutationFn: async ({ studentId, displaceAttendeeId }: { studentId: string, displaceAttendeeId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !classId) throw new Error('Dados inválidos.');

      if (displaceAttendeeId) {
        const { error: deleteError } = await supabase.from('class_attendees').delete().eq('id', displaceAttendeeId);
        if (deleteError) throw deleteError;
      }

      const { error: insertError } = await supabase.from('class_attendees').insert({
        user_id: user.id,
        class_id: classId,
        status: 'Agendado',
        student_id: studentId,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      invalidateClassQueries();
      showSuccess('Aluno adicionado à aula!');
    },
    onError: (error) => { showError(error.message); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ attendeeId, status }: { attendeeId: string; status: AttendanceStatus }) => {
      const { error } = await supabase.from('class_attendees').update({ status }).eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateClassQueries();
      showSuccess('Status de presença atualizado.');
    },
    onError: (error) => { showError(error.message); },
  });

  const removeAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase.from('class_attendees').delete().eq('id', attendeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateClassQueries();
      showSuccess('Aluno removido da aula!');
    },
    onError: (error) => { showError(error.message); },
  });

  const updateClassMutation = useMutation({
    mutationFn: async (formData: ClassFormData) => {
      if (!classId) throw new Error("ID da aula não encontrado.");
      const classTitle = formData.student_id
        ? allStudents?.find(s => s.id === formData.student_id)?.name || 'Aula com Aluno'
        : formData.title;

      const [hours, minutes] = formData.time.split(':');
      const dateTime = set(new Date(formData.date), {
        hours: parseInt(hours),
        minutes: parseInt(minutes),
        seconds: 0,
        milliseconds: 0,
      });
      
      const startUtc = fromZonedTime(dateTime, Intl.DateTimeFormat().resolvedOptions().timeZone).toISOString();
      
      const dataToSubmit = {
        title: classTitle,
        start_time: startUtc,
        notes: formData.notes,
        student_id: formData.student_id || null,
      };
      const { error } = await supabase.from('classes').update(dataToSubmit).eq('id', classId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateClassQueries();
      showSuccess('Aula atualizada com sucesso!');
    },
    onError: (error) => { showError(error.message); },
  });

  const deleteClassMutation = useMutation({
    mutationFn: async () => {
      if (!classId) throw new Error("ID da aula não encontrado.");
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateClassQueries();
      showSuccess("Aula excluída com sucesso!");
    },
    onError: (error) => { showError(error.message); }
  });

  return {
    addAttendee: addAttendeeMutation.mutate,
    isAddingAttendee: addAttendeeMutation.isPending,
    updateAttendeeStatus: updateStatusMutation.mutate,
    isUpdatingAttendeeStatus: updateStatusMutation.isPending,
    removeAttendee: removeAttendeeMutation.mutate,
    isRemovingAttendee: removeAttendeeMutation.isPending,
    updateClass: updateClassMutation.mutate,
    isUpdatingClass: updateClassMutation.isPending,
    deleteClass: deleteClassMutation.mutate,
    isDeletingClass: deleteClassMutation.isPending,
  };
};