import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Upload } from 'lucide-react';
import { ColoredSeparator } from '@/components/ColoredSeparator';

interface StudentsHeaderProps {
  studentCount: number | undefined;
  onAddNewStudent: () => void;
  onImportCSV: () => void; // Nova prop
}

const StudentsHeader = ({ studentCount, onAddNewStudent, onImportCSV }: StudentsHeaderProps) => {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-primary rounded-xl">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Gestão de Alunos
            </h1>
            <p className="text-muted-foreground">
              {studentCount || 0} alunos cadastrados
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onImportCSV}>
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
          </Button>
          <Button onClick={onAddNewStudent}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Adicionar Aluno
          </Button>
        </div>
      </div>
      <ColoredSeparator color="primary" />
    </>
  );
};

export default StudentsHeader;