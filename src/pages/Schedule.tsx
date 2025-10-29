import { useState, useMemo, useCallback, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import ClassDetailsDialog from '@/components/schedule/ClassDetailsDialog'; // default export now
import AddRecurringClassTemplateDialog from '@/components/schedule/AddRecurringClassTemplateDialog';
import RecurringTemplatesList from '@/components/schedule/RecurringTemplatesList';
import { ClassEvent, RecurringClassTemplate } from '@/types/schedule';
import { StudentOption } from '@/types/student';
import { useAppSettings } from '@/hooks/useAppSettings';
import ColoredSeparator from "@/components/ColoredSeparator";
import { parseISO, format, addDays, startOfDay, endOfDay, startOfWeek, isToday, isWeekend, addWeeks, subWeeks, setMinutes, setHours } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';