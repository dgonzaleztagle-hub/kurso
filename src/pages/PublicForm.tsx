import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FieldPreview } from '@/components/form-builder/FieldPreview';
import { Form, FormField, FieldOption, ScaleConfig, MatrixConfig, FieldType } from '@/types/forms';
import logoSantaCruz from '@/assets/logo-santa-cruz.png';

export default function PublicForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, studentId, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasExistingResponse, setHasExistingResponse] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Wait for auth to fully load before checking form
  useEffect(() => {
    if (!authLoading) {
      loadForm();
    }
  }, [id, user, studentId, authLoading]);

  // Update document title dynamically
  useEffect(() => {
    if (form) {
      document.title = `${form.title} - Pre Kinder B`;
    }
    return () => {
      document.title = 'Sistema de Gestión de Pagos - Pre Kinder B';
    };
  }, [form]);

  const loadForm = async () => {
    if (!id) return;
    
    try {
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', id)
        .single();
        
      if (formError) throw formError;
      
      if (!formData.is_active) {
        toast.error('Este formulario ya no está disponible');
        return;
      }
      
      if (formData.closes_at && new Date(formData.closes_at) < new Date()) {
        toast.error('Este formulario ha cerrado');
        return;
      }
      
      if (formData.requires_login && !user) {
        navigate(`/auth?redirect=/formulario/${id}`);
        return;
      }
      
      // Check for existing response if multiple responses not allowed
      if (!formData.allow_multiple_responses && (studentId || user)) {
        let query = supabase
          .from('form_responses')
          .select('id')
          .eq('form_id', id)
          .limit(1);

        if (studentId) {
          query = query.eq('student_id', studentId);
        } else if (user) {
          query = query.eq('user_id', user.id);
        }

        const { data: existingResponse } = await query.maybeSingle();
        
        if (existingResponse) {
          setHasExistingResponse(true);
          setForm(formData);
          setLoading(false);
          return;
        }
      }
      
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

  const shouldShowField = (field: FormField): boolean => {
    if (!field.conditional_logic?.enabled) return true;
    
    const { fieldId, operator, value } = field.conditional_logic;
    const fieldValue = values[fieldId];
    
    // Find the source field to determine comparison logic
    const sourceField = fields.find(f => f.id === fieldId);
    
    // SEGURIDAD: Si el campo padre no existe, ocultar este campo
    if (!sourceField) {
      console.warn(`Campo condicional "${field.label}" referencia un campo inexistente: ${fieldId}`);
      return false;
    }
    
    // Normalize values for comparison based on field type
    const normalizeValue = (val: any, conditionValue: string): boolean => {
      // Handle checkbox (boolean) comparisons
      if (sourceField?.field_type === 'checkbox') {
        const boolValue = val === true || val === 'true';
        const conditionBool = conditionValue === 'true';
        return operator === 'equals' ? boolValue === conditionBool : boolValue !== conditionBool;
      }
      
      // Handle single_choice - compare option IDs directly
      if (sourceField?.field_type === 'single_choice') {
        return operator === 'equals' 
          ? val === conditionValue 
          : val !== conditionValue;
      }
      
      // Handle multiple_choice - check if array contains the option ID
      if (sourceField?.field_type === 'multiple_choice') {
        const isSelected = Array.isArray(val) && val.includes(conditionValue);
        return operator === 'equals' ? isSelected : !isSelected;
      }
      
      // Handle text comparisons
      const strVal = String(val || '').toLowerCase();
      const strCondition = conditionValue.toLowerCase();
      
      switch (operator) {
        case 'equals':
          return strVal === strCondition;
        case 'not_equals':
          return strVal !== strCondition;
        case 'contains':
          return strVal.includes(strCondition);
        case 'not_contains':
          return !strVal.includes(strCondition);
        default:
          return true;
      }
    };
    
    return normalizeValue(fieldValue, value);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    fields.filter(shouldShowField).forEach(field => {
      if (field.is_required) {
        const value = values[field.id];
        
        if (value === undefined || value === null || value === '') {
          newErrors[field.id] = 'Este campo es obligatorio';
        } else if (Array.isArray(value) && value.length === 0) {
          newErrors[field.id] = 'Selecciona al menos una opción';
        } else if (field.field_type === 'matrix') {
          const config = field.options as MatrixConfig;
          const matrixValue = value as Record<string, string>;
          const answeredRows = Object.keys(matrixValue || {}).length;
          if (answeredRows < config.rows.length) {
            newErrors[field.id] = 'Responde todas las filas';
          }
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${id}/${fileName}`;
    
    const { error } = await supabase.storage
      .from('form-uploads')
      .upload(filePath, file);
      
    if (error) throw error;
    
    const { data } = supabase.storage
      .from('form-uploads')
      .getPublicUrl(filePath);
      
    return data.publicUrl;
  };

  const submitForm = async () => {
    if (!validateForm()) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Verificación doble: comprobar nuevamente si ya existe una respuesta
      if (!form?.allow_multiple_responses && (studentId || user)) {
        let query = supabase
          .from('form_responses')
          .select('id')
          .eq('form_id', id)
          .limit(1);

        if (studentId) {
          query = query.eq('student_id', studentId);
        } else if (user) {
          query = query.eq('user_id', user.id);
        }

        const { data: existingResponse } = await query.maybeSingle();
        
        if (existingResponse) {
          toast.error('Ya has respondido este formulario');
          setHasExistingResponse(true);
          setSubmitting(false);
          return;
        }
      }
      
      const responseData: Record<string, any> = {};
      
      for (const field of fields.filter(shouldShowField)) {
        let value = values[field.id];
        
        if (field.field_type === 'file' && value instanceof File) {
          value = await uploadFile(value);
        }
        
        responseData[field.id] = value;
      }
      
      const { error } = await supabase
        .from('form_responses')
        .insert({
          form_id: id,
          user_id: user?.id || null,
          student_id: studentId || null,
          response_data: responseData
        });
        
      if (error) throw error;
      
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Error al enviar respuesta');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-bold">Formulario no disponible</h2>
            <p className="text-muted-foreground mt-2">
              Este formulario no existe o ya no está activo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasExistingResponse) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-primary mb-4" />
            <h2 className="text-xl font-bold">Ya respondiste este formulario</h2>
            <p className="text-muted-foreground mt-2">
              Solo se permite una respuesta por usuario para este formulario.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold">¡Respuesta enviada!</h2>
            <p className="text-muted-foreground mt-2">
              Gracias por completar el formulario.
            </p>
            {form.allow_multiple_responses && (
              <Button 
                className="mt-4" 
                onClick={() => {
                  setSubmitted(false);
                  setValues({});
                }}
              >
                Enviar otra respuesta
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <img src={logoSantaCruz} alt="Logo" className="h-16 mx-auto mb-4" />
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{form.title}</CardTitle>
            {form.description && (
              <CardDescription className="text-base">{form.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {fields.filter(shouldShowField).map((field) => (
              <FieldPreview
                key={field.id}
                field={field}
                value={values[field.id]}
                onChange={(value) => {
                  setValues({ ...values, [field.id]: value });
                  if (errors[field.id]) {
                    setErrors({ ...errors, [field.id]: '' });
                  }
                }}
                error={errors[field.id]}
              />
            ))}
            
            <Button 
              className="w-full" 
              size="lg" 
              onClick={submitForm}
              disabled={submitting}
            >
              {submitting ? 'Enviando...' : 'Enviar respuesta'}
            </Button>
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground">
          Formulario creado con el sistema de gestión del Pre Kinder B
        </p>
      </div>
    </div>
  );
}
