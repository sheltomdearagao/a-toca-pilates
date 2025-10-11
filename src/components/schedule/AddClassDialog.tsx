import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';

const classSchema = z.object({
  title: z.string().min(3, 'O título é obrigatório.'),
  start_time: z.string().min(1, 'A data e hora de início são obrigatórias.'),
  end_time: z.string().min(1, 'A data e hora de fim são obrigatórias.'),
  notes: z.string().optional(),
}).refine(data => new Date(data.end_time) > new Date(data.start_time), {
  message: 'A hora de fim deve ser posterior à hora de início.',
  path: ['end_time'],
});

type ClassFormData = z.infer<typeof classSchema>;

interface AddClassDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const AddClassDialog = ({ isOpen, onOpenChange }: AddClassDialogProps) => {
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      title: '',
      start_time: '',
      end_time: '',
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (formData: ClassFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const dataToSubmit = {
        user_id: user.id,
        title: formData.title,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        notes: formData.notes,
      };

      const { error } = await supabase.from('classes').insert([dataToSubmit]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      showSuccess('Aula agendada com sucesso!');
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const onSubmit = (data: ClassFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Nova Aula</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Aula</Label>
              <Controller name="title" control={control} render={({ field }) => <Input id="title" {...field} />} />
              {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Início</Label>
                <Controller name="start_time" control={control} render={({ field }) => <Input id="start_time" type="datetime-local" {...field} />} />
                {errors.start_time && <p className="text-sm text-destructive mt-1">{errors.start_time.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Fim</Label>
                <Controller name="end_time" control={control} render={({ field }) => <Input id="end_time" type="datetime-local" {...field} />} />
                {errors.end_time && <p className="text-sm text-destructive mt-1">{errors.end_time.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas (Opcional)</Label>
              <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" {...field} />} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClassDialog;