import React from 'react';
import { Student } from '@/types/student';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StickyNote, Mail, Phone, Cake, CalendarCheck, Home, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface StudentDetailsCardProps {
  student: Student | undefined;
  isLoading: boolean;
}

const StudentDetailsCard = ({ student, isLoading }: StudentDetailsCardProps) => {
  return (
    <Card variant="bordered" className="lg:col-span-1 shadow-impressionist shadow-subtle-glow">
      <CardHeader>
        <CardTitle className="flex items-center"><StickyNote className="w-5 h-5 mr-2" /> Detalhes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <div className="flex items-center">
              <Mail className="w-4 h-4 mr-3 text-muted-foreground" />
              <span>{student?.email || 'Não informado'}</span>
            </div>
            <div className="flex items-center">
              <Phone className="w-4 h-4 mr-3 text-muted-foreground" />
              <span>{student?.phone || 'Não informado'}</span>
            </div>
            <div className="flex items-center">
              <Home className="w-4 h-4 mr-3 text-muted-foreground" />
              <span>{student?.address || 'Não informado'}</span>
            </div>
            <div className="flex items-center">
              <User className="w-4 h-4 mr-3 text-muted-foreground" />
              <span>Responsável: {student?.guardian_phone || 'Não informado'}</span>
            </div>
            {student?.date_of_birth && (
              <div className="flex items-center">
                <Cake className="w-4 h-4 mr-3 text-muted-foreground" />
                <span>{format(parseISO(student.date_of_birth), 'dd/MM/yyyy')}</span>
              </div>
            )}
            {student?.validity_date && (
              <div className="flex items-center">
                <CalendarCheck className="w-4 h-4 mr-3 text-muted-foreground" />
                <span>Validade: {format(parseISO(student.validity_date), 'dd/MM/yyyy')}</span>
              </div>
            )}
            {student?.notes && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground">{student.notes}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentDetailsCard;