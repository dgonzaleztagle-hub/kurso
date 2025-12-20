import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Share2, Eye, BarChart3, Copy, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';

interface FormWithResponses {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  closes_at: string | null;
  response_count: number;
}

export default function FormList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<FormWithResponses[]>([]);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const { data: formsData, error: formsError } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (formsError) throw formsError;
      
      const formsWithCounts = await Promise.all(
        formsData.map(async (form) => {
          const { count } = await supabase
            .from('form_responses')
            .select('*', { count: 'exact', head: true })
            .eq('form_id', form.id);
            
          return {
            ...form,
            response_count: count || 0
          };
        })
      );
      
      setForms(formsWithCounts);
    } catch (error) {
      console.error('Error loading forms:', error);
      toast.error('Error al cargar formularios');
    } finally {
      setLoading(false);
    }
  };

  const toggleFormStatus = async (formId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('forms')
        .update({ is_active: !currentStatus })
        .eq('id', formId);
        
      if (error) throw error;
      
      setForms(forms.map(f => 
        f.id === formId ? { ...f, is_active: !currentStatus } : f
      ));
      
      toast.success(`Formulario ${!currentStatus ? 'activado' : 'desactivado'}`);
    } catch (error) {
      console.error('Error toggling form:', error);
      toast.error('Error al cambiar estado');
    }
  };

  const duplicateForm = async (formId: string) => {
    try {
      const { data: originalForm, error: formError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();
        
      if (formError) throw formError;
      
      const { data: originalFields, error: fieldsError } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId);
        
      if (fieldsError) throw fieldsError;
      
      const { data: newForm, error: createError } = await supabase
        .from('forms')
        .insert({
          title: `${originalForm.title} (copia)`,
          description: originalForm.description,
          is_active: false,
          is_public: originalForm.is_public,
          requires_login: originalForm.requires_login,
          allow_multiple_responses: originalForm.allow_multiple_responses,
          created_by: originalForm.created_by
        })
        .select()
        .single();
        
      if (createError) throw createError;
      
      if (originalFields.length > 0) {
        const newFields = originalFields.map(field => ({
          form_id: newForm.id,
          order_index: field.order_index,
          field_type: field.field_type,
          label: field.label,
          description: field.description,
          is_required: field.is_required,
          options: field.options,
          conditional_logic: field.conditional_logic
        }));
        
        const { error: insertError } = await supabase
          .from('form_fields')
          .insert(newFields);
          
        if (insertError) throw insertError;
      }
      
      toast.success('Formulario duplicado');
      loadForms();
    } catch (error) {
      console.error('Error duplicating form:', error);
      toast.error('Error al duplicar formulario');
    }
  };

  const deleteForm = async (formId: string) => {
    try {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', formId);
        
      if (error) throw error;
      
      setForms(forms.filter(f => f.id !== formId));
      toast.success('Formulario eliminado');
    } catch (error) {
      console.error('Error deleting form:', error);
      toast.error('Error al eliminar formulario');
    }
  };

  const shareForm = async (form: FormWithResponses) => {
    const formUrl = `${window.location.origin}/formulario/${form.id}`;
    const shareText = `Pre Kinder B le solicita completar el siguiente formulario: "${form.title}"${form.description ? ` - ${form.description}` : ''}`;
    const clipboardText = `Pre Kinder B le solicita completar el siguiente formulario: "${form.title}"\n${formUrl}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Formulario: ${form.title}`,
          text: shareText,
          url: formUrl
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(clipboardText);
          toast.success('Enlace copiado');
        }
      }
    } else {
      await navigator.clipboard.writeText(clipboardText);
      toast.success('Enlace copiado');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Formularios</h1>
          <Button onClick={() => navigate('/formularios/nuevo')}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo formulario
          </Button>
        </div>

        {forms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No hay formularios creados</p>
              <Button onClick={() => navigate('/formularios/nuevo')}>
                <Plus className="h-4 w-4 mr-1" />
                Crear primer formulario
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {forms.map((form) => (
              <Card key={form.id} className={!form.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{form.title}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Creado {format(new Date(form.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                      </CardDescription>
                    </div>
                    <Badge variant={form.is_active ? "default" : "secondary"}>
                      {form.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {form.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {form.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart3 className="h-4 w-4" />
                    <span>{form.response_count} respuestas</span>
                  </div>
                  
                  {form.closes_at && (
                    <p className="text-xs text-muted-foreground">
                      Cierra: {format(new Date(form.closes_at), "d/MM/yyyy", { locale: es })}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap gap-1 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/formularios/${form.id}/editar`)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/formularios/${form.id}/respuestas`)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Respuestas
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => shareForm(form)}
                    >
                      <Share2 className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toggleFormStatus(form.id, form.is_active)}
                    >
                      {form.is_active ? (
                        <ToggleRight className="h-3 w-3" />
                      ) : (
                        <ToggleLeft className="h-3 w-3" />
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => duplicateForm(form.id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar formulario?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará el formulario y todas sus respuestas. No se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteForm(form.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
