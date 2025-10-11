import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const Dashboard = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alunos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">...</div>
            <p className="text-xs text-muted-foreground">Carregando dados...</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">...</div>
            <p className="text-xs text-muted-foreground">Carregando dados...</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inadimplência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">...</div>
            <p className="text-xs text-muted-foreground">Carregando dados...</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aulas Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">...</div>
            <p className="text-xs text-muted-foreground">Carregando dados...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;