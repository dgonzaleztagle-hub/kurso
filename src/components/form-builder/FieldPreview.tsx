import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { FormField, FieldOption, ScaleConfig, MatrixConfig } from '@/types/forms';

interface FieldPreviewProps {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

export function FieldPreview({ field, value, onChange, error }: FieldPreviewProps) {
  const renderField = () => {
    switch (field.field_type) {
      case 'short_text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Tu respuesta..."
          />
        );
        
      case 'long_text':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Tu respuesta..."
            rows={4}
          />
        );
        
      case 'single_choice': {
        const options = Array.isArray(field.options) ? field.options : [];
        return (
          <RadioGroup value={value || ''} onValueChange={onChange}>
            {options.map((option: FieldOption) => (
              <div key={option.id} className="flex items-center space-x-2">
                <RadioGroupItem value={option.id} id={option.id} />
                <Label htmlFor={option.id} className="cursor-pointer">{option.label}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      }
        
      case 'multiple_choice': {
        const options = Array.isArray(field.options) ? field.options : [];
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {options.map((option: FieldOption) => (
              <div key={option.id} className="flex items-center space-x-2">
                <Checkbox
                  id={option.id}
                  checked={selectedValues.includes(option.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, option.id]);
                    } else {
                      onChange(selectedValues.filter((v: string) => v !== option.id));
                    }
                  }}
                />
                <Label htmlFor={option.id} className="cursor-pointer">{option.label}</Label>
              </div>
            ))}
          </div>
        );
      }
        
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value || false}
              onCheckedChange={onChange}
            />
            <Label htmlFor={field.id} className="cursor-pointer">Sí</Label>
          </div>
        );
        
      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value), "PPP", { locale: es }) : "Seleccionar fecha..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => onChange(date?.toISOString())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
        
      case 'file':
        return (
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <input
              type="file"
              id={field.id}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onChange(file);
              }}
            />
            <Label htmlFor={field.id} className="cursor-pointer text-primary hover:underline">
              {value?.name || 'Haz clic para subir un archivo'}
            </Label>
          </div>
        );
        
      case 'scale': {
        const config = (field.options as ScaleConfig) || { min: 1, max: 5 };
        const numbers = [];
        for (let i = config.min; i <= config.max; i++) {
          numbers.push(i);
        }
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{config.minLabel || config.min}</span>
              <span>{config.maxLabel || config.max}</span>
            </div>
            <div className="flex justify-between gap-1">
              {numbers.map((num) => (
                <Button
                  key={num}
                  variant={value === num ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => onChange(num)}
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
        );
      }
        
      case 'matrix': {
        const config = (field.options as MatrixConfig) || { rows: [], columns: [] };
        const matrixValue = (value as Record<string, string>) || {};
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2"></th>
                  {config.columns.map((col) => (
                    <th key={col.id} className="p-2 text-center font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2 font-medium">{row.label}</td>
                    {config.columns.map((col) => (
                      <td key={col.id} className="p-2 text-center">
                        <RadioGroup
                          value={matrixValue[row.id] || ''}
                          onValueChange={(colId) => onChange({ ...matrixValue, [row.id]: colId })}
                          className="flex justify-center"
                        >
                          <RadioGroupItem value={col.id} />
                        </RadioGroup>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
        
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-1">
        <Label className="text-base font-medium">
          {field.label}
        </Label>
        {field.is_required && <span className="text-destructive">*</span>}
      </div>
      {field.description && (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      )}
      {renderField()}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
