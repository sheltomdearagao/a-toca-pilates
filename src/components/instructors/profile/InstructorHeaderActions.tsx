import React from 'react';
import { Link } from 'react-router-dom';
import { Instructor } from '@/types/instructor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, UserCog, Edit, CalendarPlus } from 'lucide-react';

interface InstructorHeaderActionsProps {
  instructor: Instructor | undefined;
  isLoading: boolean;
  onEdit: () => void;
}

const InstructorHeaderActions = ({
  instructor,
  isLoading,
  onEdit,
}: InstructorHeaderActionsProps) => {
  return (
    <div>
      <Button asChild variant="outline" className="mb-4">
        <Link to="/instrutores">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Instrutores
        </Link>
      </Button>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-muted rounded-full">
            {isLoading ? <Skeleton className="w-8 h-8 rounded-full" /> : <UserCog className="w-8 h-8 text-muted-foreground" />}
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-48" /> : instructor?.name}
            </h1>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Skeleton className="h-6 w-20 rounded-full" />
              ) : (
                <Badge variant={
                  instructor?.status === 'Ativo' ? 'status-active' :
                  instructor?.status === 'Inativo' ? 'status-inactive' :
                  'status-experimental' // Usando experimental para férias
                }>{instructor?.status}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isLoading ? (
            <Skeleton className="h-10 w-36" />
          ) : (
            <Button variant="outline" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Editar Cadastro
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructorHeaderActions;