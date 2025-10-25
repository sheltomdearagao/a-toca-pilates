import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2, Download } from 'lucide-react';
import { exportDataToCsv } from '@/utils/dataExporter';
import { showSuccess } from '@/utils/toast';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DataExporterDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const EXPORT_OPTIONS = [
  { key: 'students', label: 'Alunos' },
  { key: 'financial_transactions', label: 'Transações Financeiras' },
  { key: 'classes', label: 'Aulas Agendadas' },
];

const DataExporterDialog = ({ isOpen, onOpenChange }: DataExporterDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const handleExport = async () => {
    if (!selectedTable) return;

    setIsExporting(true);
    const success = await exportDataToCsv(selectedTable as 'students' | 'financial_transactions' | 'classes');
    setIsExporting(false);

    if (success) {
      showSuccess(`Exportação de ${EXPORT_OPTIONS.find(o => o.key === selectedTable)?.label} concluída!`);
      onOpenChange(false);
      setSelectedTable(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Dados para Backup</DialogTitle>
          <DialogDescription>
            Selecione a tabela que deseja exportar para um arquivo CSV.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {EXPORT_OPTIONS.map(option => (
            <Card 
              key={option.key} 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                selectedTable === option.key ? "border-primary ring-2 ring-primary/50" : "border-border"
              )}
              onClick={() => setSelectedTable(option.key)}
            >
              <CardContent className="p-4 font-medium">
                {option.label}
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isExporting}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleExport} disabled={isExporting || !selectedTable}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isExporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DataExporterDialog;