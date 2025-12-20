import { useState } from 'react';
import { Trash2, Plus, X, Settings2, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField, FieldOption, ScaleConfig, MatrixConfig, FIELD_TYPE_LABELS } from '@/types/forms';

interface FieldEditorProps {
  field: FormField;
  allFields: FormField[];
  onUpdate: (field: FormField) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function FieldEditor({ field, allFields, onUpdate, onDelete, onMoveUp, onMoveDown }: FieldEditorProps) {
  const [showConditional, setShowConditional] = useState(!!field.conditional_logic?.enabled);

  const updateField = (updates: Partial<FormField>) => {
    onUpdate({ ...field, ...updates });
  };

  const addOption = () => {
    const currentOptions = Array.isArray(field.options) ? field.options : [];
    const newOption: FieldOption = {
      id: crypto.randomUUID(),
      label: `Opción ${currentOptions.length + 1}`
    };
    updateField({ options: [...currentOptions, newOption] });
  };

  const updateOption = (optionId: string, label: string) => {
    if (!Array.isArray(field.options)) return;
    const updatedOptions = field.options.map(opt => 
      opt.id === optionId ? { ...opt, label } : opt
    );
    updateField({ options: updatedOptions });
  };

  const deleteOption = (optionId: string) => {
    if (!Array.isArray(field.options)) return;
    updateField({ options: field.options.filter(opt => opt.id !== optionId) });
  };

  const renderOptionsEditor = () => {
    if (!['single_choice', 'multiple_choice'].includes(field.field_type)) return null;
    
    const options = Array.isArray(field.options) ? field.options : [];
    
    return (
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Opciones</Label>
        {options.map((option: FieldOption) => (
          <div key={option.id} className="flex items-center gap-2">
            <Input
              value={option.label}
              onChange={(e) => updateOption(option.id, e.target.value)}
              placeholder="Texto de la opción"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteOption(option.id)}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addOption} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Agregar opción
        </Button>
      </div>
    );
  };

  const renderScaleEditor = () => {
    if (field.field_type !== 'scale') return null;
    
    const config = (field.options as ScaleConfig) || { min: 1, max: 5, minLabel: '', maxLabel: '' };
    
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm text-muted-foreground">Mínimo</Label>
            <Input
              type="number"
              value={config.min}
              onChange={(e) => updateField({ 
                options: { ...config, min: parseInt(e.target.value) || 1 } 
              })}
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Máximo</Label>
            <Input
              type="number"
              value={config.max}
              onChange={(e) => updateField({ 
                options: { ...config, max: parseInt(e.target.value) || 10 } 
              })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm text-muted-foreground">Etiqueta mínimo</Label>
            <Input
              value={config.minLabel || ''}
              onChange={(e) => updateField({ 
                options: { ...config, minLabel: e.target.value } 
              })}
              placeholder="Ej: Muy malo"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Etiqueta máximo</Label>
            <Input
              value={config.maxLabel || ''}
              onChange={(e) => updateField({ 
                options: { ...config, maxLabel: e.target.value } 
              })}
              placeholder="Ej: Excelente"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderMatrixEditor = () => {
    if (field.field_type !== 'matrix') return null;
    
    const config = (field.options as MatrixConfig) || { rows: [], columns: [] };
    
    const addRow = () => {
      const newRow: FieldOption = { id: crypto.randomUUID(), label: `Fila ${config.rows.length + 1}` };
      updateField({ options: { ...config, rows: [...config.rows, newRow] } });
    };
    
    const addColumn = () => {
      const newCol: FieldOption = { id: crypto.randomUUID(), label: `Columna ${config.columns.length + 1}` };
      updateField({ options: { ...config, columns: [...config.columns, newCol] } });
    };
    
    const updateRow = (id: string, label: string) => {
      updateField({ 
        options: { ...config, rows: config.rows.map(r => r.id === id ? { ...r, label } : r) } 
      });
    };
    
    const updateColumn = (id: string, label: string) => {
      updateField({ 
        options: { ...config, columns: config.columns.map(c => c.id === id ? { ...c, label } : c) } 
      });
    };
    
    const deleteRow = (id: string) => {
      updateField({ options: { ...config, rows: config.rows.filter(r => r.id !== id) } });
    };
    
    const deleteColumn = (id: string) => {
      updateField({ options: { ...config, columns: config.columns.filter(c => c.id !== id) } });
    };
    
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-sm text-muted-foreground">Filas (preguntas)</Label>
          <div className="space-y-2 mt-1">
            {config.rows.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <Input
                  value={row.label}
                  onChange={(e) => updateRow(row.id, e.target.value)}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => deleteRow(row.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addRow} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Agregar fila
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-sm text-muted-foreground">Columnas (opciones)</Label>
          <div className="space-y-2 mt-1">
            {config.columns.map((col) => (
              <div key={col.id} className="flex items-center gap-2">
                <Input
                  value={col.label}
                  onChange={(e) => updateColumn(col.id, e.target.value)}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => deleteColumn(col.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addColumn} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Agregar columna
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const availableFieldsForCondition = allFields.filter(f => 
    f.id !== field.id && 
    ['single_choice', 'multiple_choice', 'checkbox', 'short_text'].includes(f.field_type)
  );

  // Get the selected condition field to render appropriate value selector
  const selectedConditionField = field.conditional_logic?.fieldId 
    ? allFields.find(f => f.id === field.conditional_logic!.fieldId)
    : null;

  // Get options for the value selector based on the selected field type
  const getValueOptions = () => {
    if (!selectedConditionField) return [];
    
    if (selectedConditionField.field_type === 'checkbox') {
      return [
        { id: 'true', label: 'Sí' },
        { id: 'false', label: 'No' }
      ];
    }
    
    if (['single_choice', 'multiple_choice'].includes(selectedConditionField.field_type)) {
      const options = selectedConditionField.options;
      if (Array.isArray(options)) {
        return options as FieldOption[];
      }
    }
    
    return [];
  };

  const valueOptions = getValueOptions();
  const showValueSelector = selectedConditionField && 
    ['single_choice', 'multiple_choice', 'checkbox'].includes(selectedConditionField.field_type);

  // Get label for the current condition value
  const getConditionValueLabel = () => {
    if (!field.conditional_logic?.value || !selectedConditionField) return '';
    
    if (selectedConditionField.field_type === 'checkbox') {
      return field.conditional_logic.value === 'true' ? 'Sí' : 'No';
    }
    
    const option = valueOptions.find(opt => opt.id === field.conditional_logic!.value);
    return option?.label || field.conditional_logic.value;
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col gap-1 pt-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onMoveUp}
              disabled={!onMoveUp}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onMoveDown}
              disabled={!onMoveDown}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                {FIELD_TYPE_LABELS[field.field_type]}
              </span>
              <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Pregunta</Label>
                <Input
                  value={field.label}
                  onChange={(e) => updateField({ label: e.target.value })}
                  placeholder="Escribe tu pregunta aquí..."
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-sm text-muted-foreground">Descripción (opcional)</Label>
                <Textarea
                  value={field.description || ''}
                  onChange={(e) => updateField({ description: e.target.value })}
                  placeholder="Añade una descripción o instrucciones..."
                  rows={2}
                  className="mt-1"
                />
              </div>
              
              {renderOptionsEditor()}
              {renderScaleEditor()}
              {renderMatrixEditor()}
              
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.is_required}
                    onCheckedChange={(checked) => updateField({ is_required: checked })}
                  />
                  <Label className="text-sm">Obligatorio</Label>
                </div>
              </div>
              
              {availableFieldsForCondition.length > 0 && (
                <Collapsible open={showConditional} onOpenChange={setShowConditional}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <Settings2 className="h-4 w-4 mr-2" />
                      Lógica condicional
                      {field.conditional_logic?.enabled && selectedConditionField && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Si "{selectedConditionField.label}" = "{getConditionValueLabel()}")
                        </span>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={field.conditional_logic?.enabled || false}
                        onCheckedChange={(enabled) => updateField({
                          conditional_logic: { 
                            ...field.conditional_logic,
                            enabled,
                            fieldId: field.conditional_logic?.fieldId || '',
                            operator: field.conditional_logic?.operator || 'equals',
                            value: field.conditional_logic?.value || ''
                          }
                        })}
                      />
                      <Label className="text-sm">Mostrar solo si...</Label>
                    </div>
                    
                    {field.conditional_logic?.enabled && (
                      <div className="space-y-2 pl-4 border-l-2 border-muted">
                        <Select
                          value={field.conditional_logic.fieldId}
                          onValueChange={(fieldId) => updateField({
                            conditional_logic: { 
                              ...field.conditional_logic!, 
                              fieldId,
                              value: '' // Reset value when changing field
                            }
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar pregunta..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableFieldsForCondition.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.label || 'Sin título'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Select
                          value={field.conditional_logic.operator}
                          onValueChange={(operator: any) => updateField({
                            conditional_logic: { ...field.conditional_logic!, operator }
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Es igual a</SelectItem>
                            <SelectItem value="not_equals">No es igual a</SelectItem>
                            {selectedConditionField?.field_type === 'short_text' && (
                              <>
                                <SelectItem value="contains">Contiene</SelectItem>
                                <SelectItem value="not_contains">No contiene</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        
                        {showValueSelector ? (
                          <Select
                            value={field.conditional_logic.value}
                            onValueChange={(value) => updateField({
                              conditional_logic: { ...field.conditional_logic!, value }
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar valor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {valueOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={field.conditional_logic.value}
                            onChange={(e) => updateField({
                              conditional_logic: { ...field.conditional_logic!, value: e.target.value }
                            })}
                            placeholder="Valor..."
                          />
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
