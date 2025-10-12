import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  class_capacity: number;
  revenue_categories: string[];
  expense_categories: string[];
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
    } else if (setting.key === 'revenue_categories') {
      try {
        settings.revenue_categories = JSON.parse(setting.value);
      } catch (e) {
        console.error("Failed to parse revenue_categories from app_settings:", e);
        settings.revenue_categories = ["Mensalidade", "Aula Avulsa", "Venda de Produto", "Outras Receitas"]; // Default fallback
      }
    } else if (setting.key === 'expense_categories') {
      try {
        settings.expense_categories = JSON.parse(setting.value);
      } catch (e) {
        console.error("Failed to parse expense_categories from app_settings:", e);
        settings.expense_categories = ["Aluguel", "Salários", "Marketing", "Material", "Contas", "Outras Despesas"]; // Default fallback
      }
    }
    // Handle other settings here
  });

  // Provide default values if not found in DB
  return {
    class_capacity: settings.class_capacity ?? 10,
    revenue_categories: settings.revenue_categories ?? ["Mensalidade", "Aula Avulsa", "Venda de Produto", "Outras Receitas"],
    expense_categories: settings.expense_categories ?? ["Aluguel", "Salários", "Marketing", "Material", "Contas", "Outras Despesas"],
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