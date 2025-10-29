import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClassEvent, ClassAttendee, AttendanceStatus } from '@/types/schedule';
import { StudentOption } from '@/types/student';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2, Edit, Trash2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { parseISO, format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

// Importar os novos componentes modulares
import ClassInfoDisplay from './class-details/ClassInfoDisplay';
import ClassEditForm, { ClassFormData } from './class-details/ClassEditForm';
import ClassAttendeesList from './class-details/ClassAttendeesList';
import AddAttendeeSection from './class-details/AddAttendeeSection';
import DeleteClassAlertDialog from './class-details/DeleteClassAlertDialog';
import DeleteAttendeeAlertDialog from './class-details/DeleteAttendeeAlertDialog';
import DisplaceConfirmationAlertDialog from './class-details/DisplaceConfirmationAlertDialog';
import { useClassManagement } from '@/hooks/useClassManagement';
import { EnrollmentType } from '@/types/student';

interface ClassDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classEvent: Partial<ClassEvent> | null;
  classCapacity: number;
}

// ...

const fetchClassDetails = async (classId: string): Promise<Partial<ClassEvent> | null> => {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id,
      title,
      start_time,
      duration_minutes,
      notes,
      student_id,
      students(name, enrollment_type)
    `)
    .eq('id', classId)
    .single();
  
  if (error) throw new Error(error.message);
  
  if (data) {
    return {
      ...data,
      students: {
        ...(data.students as any),
      } as any,
    };
  }
  return null;
};

// ...