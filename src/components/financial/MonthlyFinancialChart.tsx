import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR'; // Corrigido o caminho de importação
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/utils/formatters"; // Importar do utilitário

interface ChartData {
  month: string;
  Receita: number;
  Despesa: number;
}

interface MonthlyFinancialChartProps {
  data: ChartData[];
  isLoading: boolean;
}

const MonthlyFinancialChart = ({ data, isLoading }: MonthlyFinancialChartProps) => {
  return (
    <Card className="col-span-full shadow-impressionist shadow-subtle-glow"> {/* Aplicando a nova sombra */}
      <CardHeader>
        <CardTitle>Receitas e Despesas Mensais (Últimos 6 meses)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[350px] flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-sm text-muted-foreground" />
              <YAxis tickFormatter={formatCurrency} tickLine={false} axisLine={false} className="text-sm text-muted-foreground" />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} formatter={(value: number) => formatCurrency(value)} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyFinancialChart;