import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
import AdminActions from '@/components/AdminActions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react';

const Admin = () => {
  const { profile } = useSession();
  const isAdmin = profile?.role === 'admin';

  // Se não for admin, redireciona para o dashboard
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-destructive rounded-xl">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
            <p className="text-muted-foreground">
              Ações de administração do sistema
            </p>
          </div>
        </div>
      </div>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Ações Perigosas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              As ações abaixo são <span className="font-bold text-destructive">irreversíveis</span> e afetam permanentemente os dados do sistema.
              Use com extrema cautela.
            </p>
            <AdminActions />
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-600/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <RefreshCw className="h-5 w-5" />
            Reset do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-red-600">Reset completo:</span> Apaga TODOS os dados e retorna o sistema ao estado inicial (virgem).
            </p>
            <p className="text-xs text-muted-foreground">
              Apenas seu perfil de administrador será mantido. O aplicativo será recarregado após o reset.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;