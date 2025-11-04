import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  class_capacity: number;
  revenue_categories: string[];
  expense_categories: string[];
  plan_types: string[];
  plan_frequencies: string[];
  payment_methods: string[];
  enrollment_types: string[];
  // Add other settings here as they become configurable
}

const parseJsonSetting = (value: string, defaultValue: string[], key: string) => {
  try {
    const parsed = JSON.parse(value);
    // Garante que o resultado seja um array de strings
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed;
    }
    throw new Error("Parsed value is not a string array.");
  } catch (e) {
    console.error(`Failed to parse ${key} from app_settings:`, e);
    return defaultValue;
  }
};

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
      settings.revenue_categories = parseJsonSetting(setting.value, ["Mensalidade", "Aula Avulsa", "Venda de Produto", "Outras Receitas"], 'revenue_categories');
    } else if (setting.key === 'expense_categories') {
      settings.expense_categories = parseJsonSetting(setting.value, ["Aluguel", "Salários", "Marketing", "Material", "Contas", "Outras Despesas"], 'expense_categories');
    } else if (setting.key === 'plan_types') {
      settings.plan_types = parseJsonSetting(setting.value, ["Mensal", "Trimestral", "Avulso"], 'plan_types');
    } else if (setting.key === 'plan_frequencies') {
      settings.plan_frequencies = parseJsonSetting(setting.value, ["2x", "3x", "4x", "5x"], 'plan_frequencies');
    } else if (setting.key === 'payment_methods') {
      settings.payment_methods = parseJsonSetting(setting.value, ["Cartão", "Espécie"], 'payment_methods');
    } else if (setting.key === 'enrollment_types') {
      settings.enrollment_types = parseJsonSetting(setting.value, ["Particular", "Wellhub", "TotalPass"], 'enrollment_types');
    }
    // Handle other settings here
  });

  // Provide default values if not found in DB
  return {
    class_capacity: settings.class_capacity ?? 10,
    revenue_categories: settings.revenue_categories ?? ["Mensalidade", "Aula Avulsa", "Venda de Produto", "Outras Receitas"],
    expense_categories: settings.expense_categories ?? ["Aluguel", "Salários", "Marketing", "Material", "Contas", "Outras Despesas"],
    plan_types: settings.plan_types ?? ["Mensal", "Trimestral", "Avulso"],
    plan_frequencies: settings.plan_frequencies ?? ["2x", "3x", "4x", "5x"],
    payment_methods: settings.payment_methods ?? ["Cartão", "Espécie"],
    enrollment_types: settings.enrollment_types ?? ["Particular", "Wellhub", "TotalPass"],
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