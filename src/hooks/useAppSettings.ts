import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Tipagem para a nova tabela de preços
type PriceTable = Record<string, Record<string, Record<string, number>>>;

interface AppSettings {
  class_capacity: number;
  revenue_categories: string[];
  expense_categories: string[];
  plan_types: string[];
  plan_frequencies: string[];
  payment_methods: string[];
  enrollment_types: string[];
  price_table: PriceTable; // Novo campo
}

const parseJsonSetting = (value: string, defaultValue: any, key: string) => {
  try {
    const parsed = JSON.parse(value);
    // Garante que o resultado seja um array de strings ou um objeto (PriceTable)
    if (Array.isArray(defaultValue)) {
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
            return parsed;
        }
    } else if (typeof defaultValue === 'object' && defaultValue !== null) {
        // Para PriceTable, apenas retorna o objeto parseado
        return parsed;
    }
    throw new Error("Parsed value type mismatch.");
  } catch (e) {
    console.error(`Failed to parse ${key} from app_settings:`, e);
    return defaultValue;
  }
};

const DEFAULT_PRICE_TABLE: PriceTable = {
  "Mensal": {
    "2x": {"Espécie": 230, "Pix": 230, "Crédito": 245, "Débito": 245},
    "3x": {"Espécie": 260, "Pix": 260, "Crédito": 275, "Débito": 275},
    "4x": {"Espécie": 285, "Pix": 285, "Crédito": 300, "Débito": 300},
    "5x": {"Espécie": 305, "Pix": 305, "Crédito": 320, "Débito": 320}
  },
  "Trimestral": {
    "2x": {"Espécie": 210, "Pix": 210, "Crédito": 225, "Débito": 225},
    "3x": {"Espécie": 240, "Pix": 240, "Crédito": 255, "Débito": 255},
    "4x": {"Espécie": 270, "Pix": 270, "Crédito": 285, "Débito": 285},
    "5x": {"Espécie": 285, "Pix": 285, "Crédito": 300, "Débito": 300}
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
      settings.payment_methods = parseJsonSetting(setting.value, ["Cartão", "Espécie", "Link"], 'payment_methods');
    } else if (setting.key === 'enrollment_types') {
      settings.enrollment_types = parseJsonSetting(setting.value, ["Particular", "Wellhub", "TotalPass"], 'enrollment_types');
    } else if (setting.key === 'price_table') {
      settings.price_table = parseJsonSetting(setting.value, DEFAULT_PRICE_TABLE, 'price_table');
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
    payment_methods: settings.payment_methods ?? ["Cartão", "Espécie", "Link"],
    enrollment_types: settings.enrollment_types ?? ["Particular", "Wellhub", "TotalPass"],
    price_table: settings.price_table ?? DEFAULT_PRICE_TABLE,
  } as AppSettings;
};

export const useAppSettings = () => {
  return useQuery<AppSettings, Error>({
    queryKey: ['appSettings'],
    queryFn: fetchAppSettings,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};