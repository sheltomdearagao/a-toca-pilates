import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  class_capacity: number;
  // Add other settings here as they become configurable
}

const fetchAppSettings = async (): Promise<AppSettings> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value');

  if (error) throw new Error(error.message);

  const settings: Partial<AppSettings> = {};
  data.forEach(setting => {
    if (setting.key === 'class_capacity') {
      settings.class_capacity = parseInt(setting.value, 10);
    }
    // Handle other settings here
  });

  // Provide default values if not found in DB
  return {
    class_capacity: settings.class_capacity ?? 10, // Default to 10 if not found
    // ... other defaults
  } as AppSettings;
};

export const useAppSettings = () => {
  return useQuery<AppSettings, Error>({
    queryKey: ['appSettings'],
    queryFn: fetchAppSettings,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};