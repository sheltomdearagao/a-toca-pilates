import React from 'react';
import AddClassDialog from '@/components/schedule/AddClassDialog';
import ClassDetailsDialog from '@/components/schedule/ClassDetailsDialog';
import AddRecurringClassTemplateDialog from '@/components/schedule/AddRecurringClassTemplateDialog';
import RecurringTemplatesList from '@/components/schedule/RecurringTemplatesList';

const Schedule: React.FC = () => {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Agenda</h1>
      <AddClassDialog isOpen={false} onOpenChange={() => {}} preSelectedStudentId={undefined} />
      <ClassDetailsDialog isOpen={false} onOpenChange={() => {}} classEvent={null} classCapacity={10} />
      <AddRecurringClassTemplateDialog isOpen={false} onOpenChange={() => {}} />
      <RecurringTemplatesList />
    </div>
  );
};

export default Schedule;