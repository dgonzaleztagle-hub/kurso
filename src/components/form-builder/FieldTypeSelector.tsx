import { 
  Type, 
  AlignLeft, 
  CircleDot, 
  CheckSquare, 
  Square, 
  Calendar, 
  Paperclip, 
  Star, 
  Grid3X3 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldType, FIELD_TYPE_LABELS } from '@/types/forms';

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
  short_text: <Type className="h-4 w-4" />,
  long_text: <AlignLeft className="h-4 w-4" />,
  single_choice: <CircleDot className="h-4 w-4" />,
  multiple_choice: <CheckSquare className="h-4 w-4" />,
  checkbox: <Square className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  file: <Paperclip className="h-4 w-4" />,
  scale: <Star className="h-4 w-4" />,
  matrix: <Grid3X3 className="h-4 w-4" />
};

interface FieldTypeSelectorProps {
  onSelect: (type: FieldType) => void;
}

export function FieldTypeSelector({ onSelect }: FieldTypeSelectorProps) {
  const fieldTypes: FieldType[] = [
    'short_text',
    'long_text',
    'single_choice',
    'multiple_choice',
    'checkbox',
    'date',
    'file',
    'scale',
    'matrix'
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {fieldTypes.map((type) => (
        <Button
          key={type}
          variant="outline"
          className="flex flex-col items-center gap-1 h-auto py-3 px-2"
          onClick={() => onSelect(type)}
        >
          {FIELD_ICONS[type]}
          <span className="text-xs text-center">{FIELD_TYPE_LABELS[type]}</span>
        </Button>
      ))}
    </div>
  );
}
