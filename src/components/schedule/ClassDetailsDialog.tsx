import React from 'react';

type ClassDetailsDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classEvent?: any;
  classCapacity?: number;
};

export const ClassDetailsDialog: React.FC<ClassDetailsDialogProps> = ({
  isOpen,
  onOpenChange,
  classEvent,
  classCapacity,
}) => {
  return null;
};

const ClassDetailsDialogDefault: React.FC<ClassDetailsDialogProps> = (props) => {
  return <ClassDetailsDialog {...props} />;
};

export default ClassDetailsDialogDefault;