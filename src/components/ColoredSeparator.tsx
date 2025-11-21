import React from 'react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ColoredSeparatorProps {
  color?: 'primary' | 'secondary' | 'accent' | 'green' | 'blue' | 'yellow' | 'red';
  className?: string;
}

const colorMap = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  accent: 'bg-accent',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

export const ColoredSeparator = ({ color = 'primary', className }: ColoredSeparatorProps) => {
  const bgColorClass = colorMap[color] || colorMap.primary;
  return (
    <Separator className={cn("my-4 h-[2px]", bgColorClass, className)} />
  );
};