import { z } from 'zod';

// Student validation schema
export const studentSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios'),
  enrollment_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
});

// Payment validation schema
export const paymentSchema = z.object({
  student_id: z.number().int().positive('ID de estudiante inválido'),
  amount: z.number().positive('El monto debe ser mayor a 0').max(999999999, 'El monto es demasiado grande'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  concept: z.string().trim().min(1, 'El concepto es requerido').max(200, 'El concepto no puede exceder 200 caracteres'),
  month_period: z.string().optional(),
  activity_id: z.number().int().positive().optional()
});

// Expense validation schema
export const expenseSchema = z.object({
  concept: z.string().trim().min(1, 'El concepto es requerido').max(200, 'El concepto no puede exceder 200 caracteres'),
  supplier: z.string().trim().min(1, 'El proveedor es requerido').max(100, 'El proveedor no puede exceder 100 caracteres'),
  amount: z.number().positive('El monto debe ser mayor a 0').max(999999999, 'El monto es demasiado grande'),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido')
});

// Activity validation schema
export const activitySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  amount: z.number().positive('El monto debe ser mayor a 0').max(999999999, 'El monto es demasiado grande'),
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido').optional()
});

// User management validation schema
export const userSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255, 'El email no puede exceder 255 caracteres'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(72, 'La contraseña no puede exceder 72 caracteres'),
  name: z.string().trim().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres')
});

// Payment notification validation schema
export const paymentNotificationSchema = z.object({
  payer_name: z.string().trim().min(1, 'El nombre del pagador es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  bank: z.string().trim().min(1, 'El banco es requerido').max(50, 'El banco no puede exceder 50 caracteres'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  amount: z.number().positive('El monto debe ser mayor a 0').max(999999999, 'El monto es demasiado grande'),
  payment_details: z.record(z.any())
});

// Reimbursement/Supplier payment validation schema
export const reimbursementSchema = z.object({
  type: z.enum(['reimbursement', 'supplier_payment']),
  amount: z.number().positive('El monto debe ser mayor a 0').max(999999999, 'El monto es demasiado grande'),
  subject: z.string().trim().min(1, 'El asunto es requerido').max(500, 'El asunto no puede exceder 500 caracteres'),
  supplier_name: z.string().trim().max(200, 'El nombre del proveedor no puede exceder 200 caracteres').optional(),
  account_info: z.record(z.any()).optional()
});
