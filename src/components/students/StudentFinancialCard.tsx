import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { format, parseISO, isPast, isToday, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Student } from '@/types/student';
import { cn } from '@/lib/utils';

interface StudentFinancialCardProps {
  student: Student | undefined;
  isLoading: boolean;
  onCreatePayment: () => void;
  onMarkAsPaid: (transactionId: string) => void;
  onViewHistory: () => void;
}

const StudentFinancialCard = ({ 
  student, 
  isLoading, 
  onCreatePayment, 
  onMarkAsPaid, 
  onViewHistory 
}: StudentFinancialCardProps) => {
  if (isLoading || !student) {
    return (
      <Card className="shadow-impressionist shadow-subtle-glow">
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Situação Financeira
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusInfo = () => {
    if (!student.validity_date) {
      return {
        status: 'Sem validade',
        color: 'bg-gray-100 text-gray-800',
        icon: <AlertCircle className="w-4 h-4" />,
        action: 'Definir validade'
      };
    }

    const validityDate = parseISO(student.validity_date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((validityDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (isPast(validityDate) && !isToday(validityDate)) {
      return {
        status: 'Vencido',
        color: 'bg-red-100 text-red-800',
        icon: <AlertCircle className="w-4 h-4" />,
        action: 'Renovar'
      };
    } else if (daysUntilExpiry <= 7) {
      return {
        status: `Vence em ${daysUntilExpiry} dias`,
        color: 'bg-yellow-100 text-yellow-800',
        icon: <Calendar className="w-4 h-4" />,
        action: 'Renovar'
      };
    } else {
      return {
        status: `Válido até ${format(validityDate, 'dd/MM/yyyy', { locale: ptBR })}`,
        color: 'bg-green-100 text-green-800',
        icon: <CheckCircle className="w-4 h-4" />,
        action: 'Ver histórico'
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Card className="shadow-impressionist shadow-subtle-glow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Situação Financeira
          </span>
          <Badge variant="outline">{student.plan_type}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status de Validade */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center space-x-2">
            {statusInfo.icon}
            <span className={cn("text-sm font-medium", statusInfo.color)}>
              {statusInfo.status}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={statusInfo.action === 'Ver histórico' ? onViewHistory : onCreatePayment}
          >
            {statusInfo.action}
          </Button>
        </div>

        {/* Informações do Plano */}
        {student.plan_type !== 'Avulso' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plano:</span>
              <span className="font-medium">
                {student.plan_type} {student.plan_frequency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mensalidade:</span>
              <span className="font-medium">
                {student.monthly_fee?.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                })}
              </span>
            </div>
            {student.payment_method && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pagamento:</span>
                <span className="font-medium">{student.payment_method}</span>
              </div>
            )}
          </div>
        )}

        {/* Tipo de Matrícula */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tipo:</span>
          <Badge variant="secondary">{student.enrollment_type}</Badge>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2 pt-4">
          <Button 
            onClick={onCreatePayment}
            className="flex-1"
            size="sm"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Criar Pagamento
          </Button>
          <Button 
            onClick={onViewHistory}
            variant="outline"
            className="flex-1"
            size="sm"
          >
            Ver Histórico
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentFinancialCard;