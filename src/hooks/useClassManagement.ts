import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { ClassAttendee, AttendanceStatus, ClassEvent } from '@/types/schedule';
import { ClassFormData } from '@/components/schedule/class-details/ClassEditForm';
import { format, set } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { StudentOption } from '@/types/student';