import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface CategoryManagerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const CategoryManagerDialog = ({ isOpen, onOpenChange }: CategoryManagerDialogProps) => {
  const queryClient = useQueryClient();
  const { data: appSettings, isLoading: isLoadingSettings } = useAppSettings();
  const [newCategory, setNewCategory] = useState('');
  const [currentTab, setCurrentTab] = useState<'revenue' | 'expense'>('revenue');

  const categoriesKey = currentTab === 'revenue' ? 'revenue_categories' : 'expense_categories';
  const currentCategories = appSettings?.[categoriesKey] || [];

  const updateCategoriesMutation = useMutation({
    mutationFn: async (updatedCategories: string[]) => {
      // Garante que a lista seja salva como JSON string no campo 'value'
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: categoriesKey, value: JSON.stringify(updatedCategories), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalida as configurações para que o hook useAppSettings recarregue os novos valores
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      showSuccess('Categorias atualizadas com sucesso!');
      setNewCategory('');
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleAddCategory = useCallback(() => {
    const trimmedCategory = newCategory.trim();
    if (!trimmedCategory || currentCategories.includes(trimmedCategory)) {
      showError('Categoria inválida ou já existente.');
      return;
    }
    const updatedCategories = [...currentCategories, trimmedCategory];
    updateCategoriesMutation.mutate(updatedCategories);
  }, [newCategory, currentCategories, updateCategoriesMutation]);

  const handleRemoveCategory = useCallback((categoryToRemove: string) => {
    const updatedCategories = currentCategories.filter(cat => cat !== categoryToRemove);
    updateCategoriesMutation.mutate(updatedCategories);
  }, [currentCategories, updateCategoriesMutation]);

  const isSubmitting = updateCategoriesMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias Financeiras</DialogTitle>
        </DialogHeader>
        
        <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'revenue' | 'expense')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="revenue">Receitas</TabsTrigger>
            <TabsTrigger value="expense">Despesas</TabsTrigger>
          </TabsList>
          <TabsContent value="revenue" className="mt-4">
            <CategoryList 
              categories={appSettings?.revenue_categories || []} 
              onRemove={handleRemoveCategory} 
              isSubmitting={isSubmitting}
            />
          </TabsContent>
          <TabsContent value="expense" className="mt-4">
            <CategoryList 
              categories={appSettings?.expense_categories || []} 
              onRemove={handleRemoveCategory} 
              isSubmitting={isSubmitting}
            />
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 mt-4">
          <Input 
            placeholder={`Nova categoria de ${currentTab === 'revenue' ? 'Receita' : 'Despesa'}`}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            disabled={isSubmitting || isLoadingSettings}
          />
          <Button onClick={handleAddCategory} disabled={isSubmitting || !newCategory.trim()}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Adicionar
          </Button>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isSubmitting}>Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Componente auxiliar para listar categorias
const CategoryList = ({ categories, onRemove, isSubmitting }: { categories: string[], onRemove: (category: string) => void, isSubmitting: boolean }) => {
    return (
        <Card>
            <CardContent className="p-4 max-h-40 overflow-y-auto">
                {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
                ) : (
                    <div className="space-y-2">
                        {categories.map(category => (
                            <div key={category} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                <span className="text-sm">{category}</span>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                    onClick={() => onRemove(category)}
                                    disabled={isSubmitting}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default CategoryManagerDialog;