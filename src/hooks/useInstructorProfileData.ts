import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Instructor } from '@/types/instructor';
import { ClassEvent } from '@/types/schedule';
import { showError } from '@/utils/toast';
import { useState } from 'react'; // Adicionado: Importação de useState

const PAGE_SIZE = 10;

export type InstructorProfileData = {
  instructor: Instructor | null;
  classesTaught: ClassEvent[];
  hasMoreClasses: boolean;
};

const fetchInstructorProfile = async (instructorId: string, classLimit: number): Promise<InstructorProfileData> => {
  // Fetch instructor details
  const { data: instructor, error: instructorError } = await supabase
    .from('instructors')
    .select('*')
    .eq('id', instructorId)
    .single();

  if (instructorError) {
    throw new Error(`Erro ao carregar dados do instrutor: ${instructorError.message}`);
  }

  // Fetch classes taught by this instructor
  const { data: classesTaught, error: classesError, count: classesCount } = await supabase
    .from('classes')
    .select(`
      id,
      title,
      start_time,
      duration_minutes,
      notes,
      student_id,
      instructor_id,
      class_attendees(count),
      students(name, enrollment_type)
    `, { count: 'exact' })
    .eq('instructor_id', instructorId)
    .order('start_time', { ascending: false })
    .limit(classLimit);

  if (classesError) {
    throw new Error(`Erro ao carregar aulas do instrutor: ${classesError.message}`);
  }

  return {
    instructor: instructor,
    classesTaught: (classesTaught as unknown as ClassEvent[]) || [],
    hasMoreClasses: (classesCount ?? 0) > classLimit,
  };
};

export const useInstructorProfileData = (instructorId: string | undefined) => {
  const queryClient = useQueryClient();
  const [classLimit, setClassLimit] = useState(PAGE_SIZE);

  const { data, isLoading, error, isFetching } = useQuery<InstructorProfileData>({
    queryKey: ['instructorProfile', instructorId, classLimit],
    queryFn: () => fetchInstructorProfile(instructorId!, classLimit),
    enabled: !!instructorId,
    staleTime: 1000 * 60 * 2, // Cache por 2 minutos
  });

  const loadMoreClasses = () => {
    setClassLimit(prev => prev + PAGE_SIZE);
  };

  return {
    instructor: data?.instructor,
    classesTaught: data?.classesTaught || [],
    hasMoreClasses: data?.hasMoreClasses ?? false,
    isLoading,
    isFetching,
    error,
    loadMoreClasses,
  };
};