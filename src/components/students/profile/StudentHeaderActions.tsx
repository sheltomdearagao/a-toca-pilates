import React from 'react';
import { Link } from 'react-router-dom';
import { Student } from '@/types/student';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, User, Calculator, PlusCircle, Edit } from 'lucide-react';

interface StudentHeaderActionsProps {
  student: Student | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onProRata: () => void;
  onAddClass: () => void;
}

const StudentHeaderActions = ({
  student,
  isLoading,
  isAdmin,
  onEdit,
  onProRata,
  onAddClass,
}: StudentHeaderActionsProps) => {
  return (
    <div>
      <Button asChild variant="outline" className="mb-4">
        <Link to="/alunos">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Alunos
        </Link>
      </Button>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-muted rounded-full">
            {isLoading ? <Skeleton className="w-8 h-8 rounded-full" /> : <User className="w-8 h-8 text-muted-foreground" />}
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-48" /> : student?.name}
            </h1>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </>
              ) : (
                <>
                  <Badge variant={
                    student?.status === 'Ativo' ? 'status-active' :
                    student?.status === 'Inativo' ? 'status-inactive' :
                    student?.status === 'Experimental' ? 'status-experimental' :
                    'status-blocked'
                  }>{student?.status}</Badge>
                  <Badge variant="secondary">{student?.enrollment_type}</Badge>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-36" />
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Editar Cadastro
              </Button>
              {student?.plan_type !== 'Avulso' && (
                <Button onClick={onProRata}>
                  <Calculator className="w-4 h-4 mr-2" />
                  Gerar 1ª Cobrança
                </Button>
              )}
              <Button onClick={onAddClass}>
                <PlusCircle className="w-4 h-4 mr-2" />
                Agendar Aula
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentHeaderActions;