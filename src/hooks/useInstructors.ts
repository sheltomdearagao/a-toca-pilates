import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Instructor, WorkingDay, InstructorStatus } from '@/types/instructor';
import { showError, showSuccess } from '@/utils/toast';

export interface InstructorFormData {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: InstructorStatus;
  hourly_rate: number | null;
  working_days: WorkingDay[] | null;
}

const fetchInstructors = async (): Promise<Instructor[]> => {
  const { data, error } = await supabase
    .from('instructors')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

const createInstructor = async (formData: InstructorFormData): Promise<Instructor> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado.');

  const { data, error } = await supabase
    .from('instructors')
    .insert({ ...formData, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Instructor;
};

const updateInstructor = async (id: string, formData: InstructorFormData): Promise<Instructor> => {
  const { data, error } = await supabase
    .from('instructors')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Instructor;
};

const deleteInstructor = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('instructors')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
};

export const useInstructors = () => {
  const queryClient = useQueryClient();

  const { data: instructors, isLoading, error } = useQuery<Instructor[]>({
    queryKey: ['instructors'],
    queryFn: fetchInstructors,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });

  const addInstructorMutation = useMutation({
    mutationFn: createInstructor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      showSuccess('Instrutor adicionado com sucesso!');
    },
    onError: (err: any) => {
      showError(err.message);
    },
  });

  const updateInstructorMutation = useMutation({
    mutationFn: ({ id, ...formData }: { id: string } & InstructorFormData) => updateInstructor(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      showSuccess('Instrutor atualizado com sucesso!');
    },
    onError: (err: any) => {
      showError(err.message);
    },
  });

  const deleteInstructorMutation = useMutation({
    mutationFn: deleteInstructor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      showSuccess('Instrutor excluído com sucesso!');
    },
    onError: (err: any) => {
      showError(err.message);
    },
  });

  return {
    instructors,
    isLoading,
    error,
    addInstructor: addInstructorMutation,
    updateInstructor: updateInstructorMutation,
    deleteInstructor: deleteInstructorMutation,
  };
};