import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Save, Eye, ArrowLeft, Share2, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { FieldTypeSelector } from '@/components/form-builder/FieldTypeSelector';
import { FieldEditor } from '@/components/form-builder/FieldEditor';
import { FieldPreview } from '@/components/form-builder/FieldPreview';
import { FormField, FieldType, Form, FieldOption, ScaleConfig, MatrixConfig } from '@/types/forms';
import { Layout } from '@/components/Layout';

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});
  
  const [form, setForm] = useState<Partial<Form>>({
    title: '',
    description: '',
    is_active: true,
    is_public: true,
    requires_login: false,
    allow_multiple_responses: false,
    closes_at: undefined
  });
  
  const [fields, setFields] = useState<FormField[]>([]);

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;
    
    const newFields = [...fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };

  useEffect(() => {
    if (isEditing) {
      loadForm();
    }
  }, [id]);

  const loadForm = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', id)
        .single();
        
      if (formError) throw formError;
      setForm(formData);
      
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', id)
        .order('order_index');
        
      if (fieldsError) throw fieldsError;
      setFields(fieldsData.map(f => ({
        ...f,
        field_type: f.field_type as FieldType,
        options: f.options as unknown as FieldOption[] | ScaleConfig | MatrixConfig,
        conditional_logic: f.conditional_logic as unknown as FormField['conditional_logic']
      })));
    } catch (error) {
      console.error('Error loading form:', error);
      toast.error('Error al cargar el formulario');
    } finally {
      setLoading(false);
    }
  };

  const addField = (type: FieldType) => {
    const defaultOptions = () => {
      switch (type) {
        case 'single_choice':
        case 'multiple_choice':
          return [
            { id: crypto.randomUUID(), label: 'Opción 1' },
            { id: crypto.randomUUID(), label: 'Opción 2' }
          ];
        case 'scale':
          return { min: 1, max: 5, minLabel: '', maxLabel: '' };
        case 'matrix':
          return { 
            rows: [{ id: crypto.randomUUID(), label: 'Fila 1' }],
            columns: [
              { id: crypto.randomUUID(), label: 'Columna 1' },
              { id: crypto.randomUUID(), label: 'Columna 2' }
            ]
          };
        default:
          return [];
      }
    };

    const newField: FormField = {
      id: crypto.randomUUID(),
      form_id: id || '',
      order_index: fields.length,
      field_type: type,
      label: '',
      description: '',
      is_required: false,
      options: defaultOptions()
    };
    
    setFields([...fields, newField]);
  };

  const updateField = (updatedField: FormField) => {
    setFields(fields.map(f => f.id === updatedField.id ? updatedField : f));
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const saveForm = async () => {
    if (!form.title?.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    
    if (fields.length === 0) {
      toast.error('Agrega al menos un campo');
      return;
    }
    
    setSaving(true);
    try {
      let formId = id;
      
      if (isEditing) {
        const { error } = await supabase
          .from('forms')
          .update({
            title: form.title,
            description: form.description,
            is_active: form.is_active,
            is_public: form.is_public,
            requires_login: form.requires_login,
            allow_multiple_responses: form.allow_multiple_responses,
            closes_at: form.closes_at
          })
          .eq('id', id);
          
        if (error) throw error;
        
        await supabase.from('form_fields').delete().eq('form_id', id);
      } else {
        const { data: newForm, error } = await supabase
          .from('forms')
          .insert({
            title: form.title,
            description: form.description,
            is_active: form.is_active,
            is_public: form.is_public,
            requires_login: form.requires_login,
            allow_multiple_responses: form.allow_multiple_responses,
            closes_at: form.closes_at,
            created_by: user?.id
          })
          .select()
          .single();
          
        if (error) throw error;
        formId = newForm.id;
      }
      
      // Crear mapeo de IDs viejos a nuevos para preservar lógica condicional
      const idMapping: Record<string, string> = {};
      const fieldsWithNewIds = fields.map(field => {
        const newId = crypto.randomUUID();
        idMapping[field.id] = newId;
        return { ...field, newId };
      });
      
      // Insertar campos con IDs nuevos y conditional_logic actualizada
      const fieldsToInsert = fieldsWithNewIds.map((field, index) => {
        // Actualizar el fieldId en conditional_logic si existe
        let updatedConditionalLogic = null;
        if (field.conditional_logic?.enabled && field.conditional_logic.fieldId) {
          const newFieldId = idMapping[field.conditional_logic.fieldId];
          if (newFieldId) {
            updatedConditionalLogic = {
              ...field.conditional_logic,
              fieldId: newFieldId
            };
          } else {
            // Si el fieldId referenciado no está en el mapeo, mantener el original
            updatedConditionalLogic = field.conditional_logic;
          }
        } else if (field.conditional_logic) {
          updatedConditionalLogic = field.conditional_logic;
        }
        
        return {
          id: field.newId,
          form_id: formId!,
          order_index: index,
          field_type: field.field_type as string,
          label: field.label,
          description: field.description,
          is_required: field.is_required,
          options: JSON.parse(JSON.stringify(field.options || [])),
          conditional_logic: updatedConditionalLogic ? JSON.parse(JSON.stringify(updatedConditionalLogic)) : null
        };
      });
      
      const { error: fieldsError } = await supabase
        .from('form_fields')
        .insert(fieldsToInsert);
        
      if (fieldsError) throw fieldsError;
      
      toast.success(isEditing ? 'Formulario actualizado' : 'Formulario creado');
      navigate('/formularios');
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Error al guardar el formulario');
    } finally {
      setSaving(false);
    }
  };

  const shareForm = async () => {
    const formUrl = `${window.location.origin}/formulario/${id}`;
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
          toast.success('Enlace copiado al portapapeles');
        }
      }
    } else {
      await navigator.clipboard.writeText(clipboardText);
      toast.success('Enlace copiado al portapapeles');
    }
  };

  const shouldShowField = (field: FormField): boolean => {
    if (!field.conditional_logic?.enabled) return true;
    
    const { fieldId, operator, value } = field.conditional_logic;
    const fieldValue = previewValues[fieldId];
    
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(value.toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(value.toLowerCase());
      default:
        return true;
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/formularios')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">
              {isEditing ? 'Editar Formulario' : 'Nuevo Formulario'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <Button variant="outline" size="sm" onClick={shareForm}>
                <Share2 className="h-4 w-4 mr-1" />
                Compartir
              </Button>
            )}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-1" />
                  Vista previa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Vista previa del formulario</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div>
                    <h2 className="text-2xl font-bold">{form.title || 'Sin título'}</h2>
                    {form.description && (
                      <p className="text-muted-foreground mt-1">{form.description}</p>
                    )}
                  </div>
                  {fields.filter(shouldShowField).map((field) => (
                    <FieldPreview
                      key={field.id}
                      field={field}
                      value={previewValues[field.id]}
                      onChange={(value) => setPreviewValues({ ...previewValues, [field.id]: value })}
                    />
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={saveForm} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <Label>Título del formulario *</Label>
                  <Input
                    value={form.title || ''}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Ej: Encuesta de satisfacción"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe el propósito de este formulario..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  allFields={fields}
                  onUpdate={updateField}
                  onDelete={() => deleteField(field.id)}
                  onMoveUp={index > 0 ? () => moveField(index, 'up') : undefined}
                  onMoveDown={index < fields.length - 1 ? () => moveField(index, 'down') : undefined}
                />
              ))}
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar campo
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Tipo de campo</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <FieldTypeSelector onSelect={(type) => {
                    addField(type);
                  }} />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configuración
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Formulario activo</Label>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Formulario público</Label>
                  <Switch
                    checked={form.is_public}
                    onCheckedChange={(checked) => setForm({ ...form, is_public: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Requiere inicio de sesión</Label>
                  <Switch
                    checked={form.requires_login}
                    onCheckedChange={(checked) => setForm({ ...form, requires_login: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Permitir múltiples respuestas</Label>
                  <Switch
                    checked={form.allow_multiple_responses}
                    onCheckedChange={(checked) => setForm({ ...form, allow_multiple_responses: checked })}
                  />
                </div>
                <div>
                  <Label className="text-sm">Fecha de cierre (opcional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !form.closes_at && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.closes_at
                          ? format(new Date(form.closes_at), "PPP", { locale: es })
                          : "Sin fecha de cierre"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.closes_at ? new Date(form.closes_at) : undefined}
                        onSelect={(date) => setForm({ ...form, closes_at: date?.toISOString() })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
