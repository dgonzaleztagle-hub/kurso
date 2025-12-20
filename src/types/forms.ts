export type FieldType = 
  | 'short_text'
  | 'long_text'
  | 'single_choice'
  | 'multiple_choice'
  | 'checkbox'
  | 'date'
  | 'file'
  | 'scale'
  | 'matrix';

export interface FieldOption {
  id: string;
  label: string;
}

export interface ScaleConfig {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface MatrixConfig {
  rows: FieldOption[];
  columns: FieldOption[];
}

export interface ConditionalLogic {
  enabled: boolean;
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains';
  value: string;
}

export interface FormField {
  id: string;
  form_id: string;
  order_index: number;
  field_type: FieldType;
  label: string;
  description?: string;
  is_required: boolean;
  options: FieldOption[] | ScaleConfig | MatrixConfig;
  conditional_logic?: ConditionalLogic;
  created_at?: string;
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  is_active: boolean;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  requires_login: boolean;
  allow_multiple_responses: boolean;
  closes_at?: string;
}

export interface FormResponse {
  id: string;
  form_id: string;
  user_id?: string;
  student_id?: number;
  submitted_at: string;
  response_data: Record<string, any>;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: 'Texto corto',
  long_text: 'Texto largo',
  single_choice: 'Opción única',
  multiple_choice: 'Opción múltiple',
  checkbox: 'Casilla de verificación',
  date: 'Fecha',
  file: 'Subida de archivo',
  scale: 'Escala',
  matrix: 'Matriz'
};

export const FIELD_TYPE_ICONS: Record<FieldType, string> = {
  short_text: 'Type',
  long_text: 'AlignLeft',
  single_choice: 'CircleDot',
  multiple_choice: 'CheckSquare',
  checkbox: 'Square',
  date: 'Calendar',
  file: 'Paperclip',
  scale: 'Star',
  matrix: 'Grid3X3'
};
