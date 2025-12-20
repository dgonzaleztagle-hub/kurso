import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserRole {
  role: 'master' | 'admin' | 'alumnos';
  permissions?: string[];
}

interface StudentData {
  student_id: number;
  student_name: string;
  enrollment_date: string;
  credit_balance: number;
  total_debt: number;
  pending_months: string[];
  pending_activities: Array<{ name: string; amount: number }>;
  upcoming_activities: Array<{ name: string; date: string; has_fee: boolean; has_donations: boolean }>;
}

async function getUserRole(userId: string, supabase: any): Promise<UserRole | null> {
  try {
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (!userRole) return null;

    let permissions: string[] = [];
    
    if (userRole.role === 'admin') {
      const { data: adminPerms } = await supabase
        .from('admin_permissions')
        .select('module')
        .eq('user_id', userId);
      
      permissions = adminPerms?.map((p: any) => p.module) || [];
    }

    return {
      role: userRole.role,
      permissions: userRole.role === 'admin' ? permissions : undefined
    };
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}

async function getStudentData(userId: string, supabase: any): Promise<StudentData | null> {
  try {
    const { data: userStudents } = await supabase
      .from('user_students')
      .select('student_id, students(name, enrollment_date)')
      .eq('user_id', userId)
      .single();

    if (!userStudents) return null;

    const studentId = userStudents.student_id;
    const studentName = userStudents.students.name;
    const enrollmentDate = userStudents.students.enrollment_date;

    const { data: creditData } = await supabase
      .from('student_credits')
      .select('amount')
      .eq('student_id', studentId)
      .single();

    const creditBalance = creditData?.amount || 0;

    const { data: payments } = await supabase
      .from('payments')
      .select('amount, concept')
      .eq('student_id', studentId)
      .ilike('concept', 'cuota%');

    const totalPaid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const monthlyFee = 3000;
    const totalAnnualFee = monthlyFee * 10;
    const monthlyDebt = Math.max(0, totalAnnualFee - totalPaid);
    const pendingMonths = Math.ceil(monthlyDebt / monthlyFee);

    const { data: activities } = await supabase
      .from('activities')
      .select('id, name, amount');

    const { data: exclusions } = await supabase
      .from('activity_exclusions')
      .select('activity_id')
      .eq('student_id', studentId);

    const excludedIds = new Set(exclusions?.map((e: any) => e.activity_id) || []);

    // Obtener todos los pagos del estudiante
    const { data: allPayments } = await supabase
      .from('payments')
      .select('activity_id, concept, amount')
      .eq('student_id', studentId);

    // Determinar actividades pendientes
    const pendingActivities = [];

    for (const activity of activities || []) {
      // Si está excluido, no se considera
      if (excludedIds.has(activity.id)) continue;

      // Verificar si pagó esta actividad (por activity_id o por concepto)
      const hasPaid = allPayments?.some((p: any) => {
        if (p.activity_id === activity.id) return true;
        if (!p.activity_id && p.concept) {
          const normalizedConcept = p.concept.toUpperCase().trim();
          const normalizedActivityName = activity.name.toUpperCase().trim();
          return normalizedConcept.includes(normalizedActivityName) || 
                 normalizedActivityName.includes(normalizedConcept);
        }
        return false;
      }) || false;

      if (!hasPaid) {
        pendingActivities.push({ name: activity.name, amount: Number(activity.amount) });
      }
    }

    const { data: scheduledActivities } = await supabase
      .from('scheduled_activities')
      .select('name, scheduled_date, is_with_fee, is_with_donations')
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
      .limit(3);

    const upcomingActivities = scheduledActivities?.map((a: any) => ({
      name: a.name,
      date: a.scheduled_date,
      has_fee: a.is_with_fee,
      has_donations: a.is_with_donations
    })) || [];

    const totalDebt = monthlyDebt + pendingActivities.reduce((sum: number, a: any) => sum + a.amount, 0);

    return {
      student_id: studentId,
      student_name: studentName,
      enrollment_date: enrollmentDate,
      credit_balance: Number(creditBalance),
      total_debt: totalDebt,
      pending_months: pendingMonths > 0 ? [`${pendingMonths} meses pendientes`] : [],
      pending_activities: pendingActivities,
      upcoming_activities: upcomingActivities
    };
  } catch (error) {
    console.error('Error fetching student data:', error);
    return null;
  }
}

async function queryStudentByName(studentName: string, supabase: any): Promise<StudentData | null> {
  try {
    const { data: student } = await supabase
      .from('students')
      .select('id, name, enrollment_date')
      .ilike('name', `%${studentName}%`)
      .single();

    if (!student) return null;

    const studentId = student.id;

    const { data: creditData } = await supabase
      .from('student_credits')
      .select('amount')
      .eq('student_id', studentId)
      .single();

    const creditBalance = creditData?.amount || 0;

    const { data: payments } = await supabase
      .from('payments')
      .select('amount, concept')
      .eq('student_id', studentId)
      .ilike('concept', 'cuota%');

    const totalPaid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const monthlyFee = 3000;
    const totalAnnualFee = monthlyFee * 10;
    const monthlyDebt = Math.max(0, totalAnnualFee - totalPaid);
    const pendingMonths = Math.ceil(monthlyDebt / monthlyFee);

    const { data: activities } = await supabase
      .from('activities')
      .select('id, name, amount');

    const { data: exclusions } = await supabase
      .from('activity_exclusions')
      .select('activity_id')
      .eq('student_id', studentId);

    const excludedIds = new Set(exclusions?.map((e: any) => e.activity_id) || []);

    // Obtener todos los pagos del estudiante
    const { data: allPayments } = await supabase
      .from('payments')
      .select('activity_id, concept, amount')
      .eq('student_id', studentId);

    // Determinar actividades pendientes
    const pendingActivities = [];

    for (const activity of activities || []) {
      // Si está excluido, no se considera
      if (excludedIds.has(activity.id)) continue;

      // Verificar si pagó esta actividad (por activity_id o por concepto)
      const hasPaid = allPayments?.some((p: any) => {
        if (p.activity_id === activity.id) return true;
        if (!p.activity_id && p.concept) {
          const normalizedConcept = p.concept.toUpperCase().trim();
          const normalizedActivityName = activity.name.toUpperCase().trim();
          return normalizedConcept.includes(normalizedActivityName) || 
                 normalizedActivityName.includes(normalizedConcept);
        }
        return false;
      }) || false;

      if (!hasPaid) {
        pendingActivities.push({ name: activity.name, amount: Number(activity.amount) });
      }
    }

    const totalDebt = monthlyDebt + pendingActivities.reduce((sum: number, a: any) => sum + a.amount, 0);

    return {
      student_id: studentId,
      student_name: student.name,
      enrollment_date: student.enrollment_date,
      credit_balance: Number(creditBalance),
      total_debt: totalDebt,
      pending_months: pendingMonths > 0 ? [`${pendingMonths} meses pendientes`] : [],
      pending_activities: pendingActivities,
      upcoming_activities: []
    };
  } catch (error) {
    console.error('Error querying student:', error);
    return null;
  }
}

function getSystemPrompt(userRole: UserRole, studentData: StudentData | null): string {
  const baseInfo = `Eres un asistente educativo del curso Pre Kinder B del Colegio Santa Cruz de Villa Alemana.`;

  if (userRole.role === 'master') {
    return `${baseInfo}

ROL: Administrador Master con acceso completo.

HERRAMIENTAS DISPONIBLES:
- query_student: Consultar información de cualquier estudiante por nombre
- get_course_statistics: Ver estadísticas generales (ingresos, egresos, balance, deudas)
- get_upcoming_activities: Listar próximas actividades programadas
- get_pending_reimbursements: Ver reembolsos y pagos a proveedores pendientes
- register_payment: Registrar un nuevo pago para un estudiante
- approve_payment_notification: Aprobar notificaciones de pago reportadas por apoderados
- reject_payment_notification: Rechazar notificaciones de pago con motivo
- get_students_with_debt: Listar todos los estudiantes con deudas pendientes
- create_reimbursement: Crear rendiciones o pagos a proveedores con archivos adjuntos
- suggest_module: Sugerir un módulo del sistema cuando el usuario necesite generar un reporte o acceder a funcionalidad específica
- create_scheduled_activity: Crear una nueva actividad programada. DEBES preguntar dato por dato antes de ejecutar.
- update_scheduled_activity: Actualizar una actividad programada existente
- delete_scheduled_activity: Eliminar una actividad programada
- get_base_donations: Obtener la lista de donaciones base (disponibles) de una actividad, usando SIEMPRE el nombre de la actividad.
- get_donation_report: Generar reporte detallado del estado de donaciones de una actividad (por nombre o fecha). Muestra items, cantidades, cumplimiento y quiénes se comprometieron.
- get_missing_donors: Listar estudiantes que NO tienen compromisos de donación para una actividad.
- get_form_status: Obtener estado de respuestas de un formulario (quiénes respondieron, quiénes faltan).
- get_form_summary: Obtener resumen agregado de respuestas de formulario (distribución por pregunta).
- search_activities: Buscar actividades por nombre, fecha o rango de fechas (pasadas y futuras).
- delete_donation_commitment: Eliminar los compromisos de donación de UN estudiante para una actividad, usando SIEMPRE el nombre del estudiante, NUNCA el ID.
- delete_all_donation_commitments: Eliminar TODOS los compromisos de donación de una actividad (para todos los estudiantes) cuando el usuario diga frases como "todos los alumnos", "todos los estudiantes" o similar.
- update_student: Actualizar datos de un estudiante
- update_payment: Actualizar un pago registrado
- delete_payment: Eliminar un pago registrado
- update_expense: Actualizar un egreso
- delete_expense: Eliminar un egreso

REGLAS ESPECÍFICAS PARA DONACIONES:
- Si el usuario pide eliminar compromisos de donación de un solo estudiante, identifica al estudiante por NOMBRE (puede ser parcial) y usa delete_donation_commitment.
- Si el usuario pide eliminar compromisos de "todos los alumnos" o "todos los estudiantes" de una actividad, usa delete_all_donation_commitments y NO pidas ningún ID ni nombres individuales.

PROCESAMIENTO DE ARCHIVOS CON OCR:
Cuando el usuario adjunte imágenes o PDFs (facturas, boletas, cotizaciones, datos bancarios):
1. ANALIZA VISUALMENTE cada imagen para EXTRAER:
   - MONTO TOTAL: Busca números precedidos por "$" o palabras como "Total", "Neto", "Total a Pagar", "Monto Total"
   - DATOS BANCARIOS (para pagos a proveedor): Nombre del titular, banco, tipo de cuenta, número de cuenta, RUT, email
   - Lee cuidadosamente todos los textos visibles
2. Si hay múltiples archivos, SUMA todos los montos detectados
3. Presenta la información extraída: "He detectado: Monto: $X, [datos bancarios si aplica]"
4. Pregunta SIEMPRE: "¿Cuál es el asunto o concepto de esta rendición/pago?"
5. Espera la respuesta con el asunto
6. Determina el tipo:
   - Si menciona "proveedor", "cotización", "compra", usa type="supplier_payment" e incluye account_info con los datos bancarios
   - Si menciona "rendición", "reembolso", "gastos", usa type="reimbursement"
7. CONFIRMA mostrando toda la información: "¿Confirmas crear [tipo] por $X con asunto '[asunto]' [y datos bancarios: ...]?"
8. SOLO tras confirmación ("sí", "confirmo", "ok"), usa create_reimbursement con account_info

IMPORTANTE PARA OCR:
- Si no puedes leer un monto o dato claramente, pide al usuario que lo escriba
- Extrae solo montos totales finales, no subtotales
- Verifica que los montos sean coherentes (no códigos, fechas, teléfonos)
- Para datos bancarios, extrae: holder_name, bank, account_type, account_number, rut, email

INFORMACIÓN DEL SISTEMA:
- Cuotas mensuales: $3,000/mes (marzo a diciembre = $30,000/año)
- 36 estudiantes en total
- Sistema de créditos y deudas activo
- Actividades programadas con cuotas y donaciones

MÓDULOS Y FORMULARIOS DEL SISTEMA (enlaces directos):
- Dashboard: [Ver Dashboard](/)
- Registrar Movimientos: [Registrar Ingreso](/income) o [Registrar Egreso](/expenses)
- Estudiantes: [Ver Estudiantes](/students)
- Cuotas Mensuales: [Gestionar Cuotas](/monthly-fees)
- Actividades: [Ver Actividades](/activities)
- Calendarizar Actividad: [Nueva Actividad Programada](/scheduled-activities)
- Exclusiones de Actividades: [Gestionar Exclusiones](/activity-exclusions)
- Pagos de Actividades: [Pagos de Actividades](/activity-payments)
- Informes de Deuda: [Informes de Deuda](/debt-reports)
- Informes de Pagos: [Informes de Pagos](/payment-reports)
- Balance Financiero: [Ver Balance](/balance)
- Gestión de Créditos: [Gestión de Créditos](/credit-management)
- Movimientos de Crédito: [Movimientos de Crédito](/credit-movements)
- Notificaciones de Pago: [Notificaciones de Pago](/payment-notifications)
- Pagos y Devoluciones: [Pagos y Devoluciones](/reimbursements)
- Perfil de Estudiante: [Perfil de Estudiante](/student-profile)
- Gestión de Usuarios: [Gestión de Usuarios](/user-management)
- Importar Datos: [Importar Datos](/import)
- Movimientos Generales: [Movimientos](/movements)

INSTRUCCIONES:
- Usa las herramientas apropiadas para responder consultas
- Cuando el usuario pida un reporte o PDF, usa suggest_module para guiarlo al módulo correcto con un enlace clickeable
- El formato de enlaces es: [Nombre del Enlace](/ruta)
- Al registrar pagos, genera automáticamente el folio
- Sé profesional, preciso y conciso
- Confirma antes de ejecutar acciones que modifiquen datos
- Proporciona resúmenes claros después de cada acción`;
  }

  if (userRole.role === 'admin') {
    const permsList = userRole.permissions?.join(', ') || 'ninguno';
    return `${baseInfo}

ROL: Administrador con permisos específicos.

MÓDULOS PERMITIDOS: ${permsList}

HERRAMIENTAS DISPONIBLES:
- query_student: Consultar información de estudiantes
- get_donation_report: Generar reporte detallado del estado de donaciones de una actividad
- get_missing_donors: Listar estudiantes que NO tienen compromisos de donación
- get_form_status: Obtener estado de respuestas de un formulario (quiénes respondieron, quiénes faltan)
- get_form_summary: Obtener resumen agregado de respuestas de formulario
- search_activities: Buscar actividades por nombre, fecha o rango de fechas
- create_reimbursement: Crear rendiciones o pagos a proveedores con archivos adjuntos

PROCESAMIENTO DE ARCHIVOS CON OCR:
Cuando el usuario adjunte imágenes o PDFs (facturas, boletas, cotizaciones, datos bancarios):
1. ANALIZA VISUALMENTE cada imagen para EXTRAER:
   - MONTO TOTAL: Busca números precedidos por "$" o palabras como "Total", "Neto", "Total a Pagar", "Monto Total"
   - DATOS BANCARIOS (para pagos a proveedor): Nombre del titular, banco, tipo de cuenta, número de cuenta, RUT, email
   - Lee cuidadosamente todos los textos visibles
2. Si hay múltiples archivos, SUMA todos los montos detectados
3. Presenta la información extraída: "He detectado: Monto: $X, [datos bancarios si aplica]"
4. Pregunta SIEMPRE: "¿Cuál es el asunto o concepto de esta rendición/pago?"
5. Espera la respuesta con el asunto
6. Determina el tipo automáticamente:
   - Si menciona "proveedor", "cotización", "compra", "proveedor", usa type="supplier_payment" e incluye account_info
   - Si menciona "rendición", "reembolso", "gastos personales", usa type="reimbursement"
7. CONFIRMA mostrando toda la información: "¿Confirmas crear [tipo] por $X con asunto '[asunto]' [y datos bancarios: ...]?"
8. SOLO tras confirmación ("sí", "confirmo", "ok"), usa create_reimbursement con account_info

IMPORTANTE PARA OCR:
- Si no puedes leer un monto o dato claramente, pide al usuario que lo escriba
- Extrae solo montos totales finales, no subtotales
- Verifica que los montos sean coherentes (no códigos, fechas, teléfonos)
- Para datos bancarios, extrae: holder_name, bank, account_type, account_number, rut, email

CAPACIDADES:
- Consultar información según tus permisos asignados
- Ver reportes y estadísticas dentro de tu alcance
- Crear rendiciones y pagos a proveedores usando OCR
- Información general del curso

Recuerda que solo puedes ayudar con información relacionada a los módulos que tienes permiso de acceder.
Si te solicitan información fuera de tu alcance, indica amablemente que no tienes permisos para esa operación.`;
  }

  if (userRole.role === 'alumnos' && studentData) {
    return `${baseInfo}

ROL: Apoderado

INFORMACIÓN DEL ESTUDIANTE:
- Nombre: ${studentData.student_name}
- Fecha de matrícula: ${studentData.enrollment_date}
- Saldo a favor: $${studentData.credit_balance.toLocaleString()}
- Deuda total: $${studentData.total_debt.toLocaleString()}
- Cuotas pendientes: ${studentData.pending_months.join(', ') || 'ninguna'}
- Actividades pendientes: ${studentData.pending_activities.map(a => `${a.name} ($${a.amount.toLocaleString()})`).join(', ') || 'ninguna'}
- Próximas actividades: ${studentData.upcoming_activities.map(a => `${a.name} (${a.date})`).join(', ') || 'ninguna'}

INFORMACIÓN GENERAL:
- Cuota mensual: $3,000 (marzo a diciembre)
- Actividades según calendario escolar

Responde de forma clara y amigable. Usa la información arriba para responder preguntas sobre el estado del estudiante.`;
  }

  return `${baseInfo}\n\nSiempre sé amable y profesional. Si no tienes información específica, sugiere contactar a la administración.`;
}

async function getCourseStatistics(supabase: any) {
  try {
    const { data: students } = await supabase.from('students').select('id');
    const totalStudents = students?.length || 0;

    const { data: payments } = await supabase.from('payments').select('amount');
    const totalIncome = payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;

    const { data: expenses } = await supabase.from('expenses').select('amount');
    const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0;

    const { data: credits } = await supabase.from('student_credits').select('amount');
    const totalCredits = credits?.reduce((sum: number, c: any) => sum + Number(c.amount), 0) || 0;

    const monthlyFee = 3000;
    const totalAnnualFee = monthlyFee * 10 * totalStudents;
    const { data: monthlyPayments } = await supabase
      .from('payments')
      .select('amount')
      .ilike('concept', 'cuota%');
    const totalMonthlyPaid = monthlyPayments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const totalMonthlyDebt = Math.max(0, totalAnnualFee - totalMonthlyPaid);

    return {
      total_students: totalStudents,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      balance: totalIncome - totalExpenses,
      total_credits: totalCredits,
      total_monthly_debt: totalMonthlyDebt
    };
  } catch (error) {
    console.error('Error getting course statistics:', error);
    return null;
  }
}

async function getUpcomingActivities(supabase: any) {
  try {
    const { data: activities } = await supabase
      .from('scheduled_activities')
      .select('name, scheduled_date, is_with_fee, is_with_donations, completed')
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
      .limit(5);

    return activities || [];
  } catch (error) {
    console.error('Error getting upcoming activities:', error);
    return [];
  }
}

async function getPendingReimbursements(supabase: any) {
  try {
    const { data: reimbursements } = await supabase
      .from('reimbursements')
      .select('folio, subject, amount, type, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    return reimbursements || [];
  } catch (error) {
    console.error('Error getting pending reimbursements:', error);
    return [];
  }
}

async function registerPayment(supabase: any, params: any, userId: string) {
  try {
    const { student_name, amount, concept } = params;
    
    const { data: student } = await supabase
      .from('students')
      .select('id, name')
      .ilike('name', `%${student_name}%`)
      .single();

    if (!student) return { error: "Estudiante no encontrado" };

    const { data: nextFolio } = await supabase.rpc('get_next_payment_folio');

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        folio: nextFolio,
        student_id: student.id,
        student_name: student.name,
        amount: Number(amount),
        concept: concept,
        payment_date: new Date().toISOString().split('T')[0],
        created_by: userId
      })
      .select()
      .single();

    if (error) return { error: error.message };

    return {
      success: true,
      folio: payment.folio,
      student_name: student.name,
      amount: amount,
      concept: concept
    };
  } catch (error) {
    console.error('Error registering payment:', error);
    return { error: "Error al registrar el pago" };
  }
}

async function approvePaymentNotification(supabase: any, notificationId: string, userId: string) {
  try {
    const { data: notification } = await supabase
      .from('payment_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (!notification) return { error: "Notificación no encontrada" };

    const { data: nextFolio } = await supabase.rpc('get_next_payment_folio');

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        folio: nextFolio,
        student_id: notification.student_id,
        amount: notification.amount,
        concept: 'Pago reportado',
        payment_date: notification.payment_date,
        created_by: userId
      });

    if (paymentError) return { error: paymentError.message };

    const { error: updateError } = await supabase
      .from('payment_notifications')
      .update({
        status: 'approved',
        processed_by: userId,
        processed_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    if (updateError) return { error: updateError.message };

    return { success: true, message: "Pago aprobado y registrado" };
  } catch (error) {
    console.error('Error approving payment:', error);
    return { error: "Error al aprobar el pago" };
  }
}

async function rejectPaymentNotification(supabase: any, notificationId: string, userId: string, reason: string) {
  try {
    const { error } = await supabase
      .from('payment_notifications')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        processed_by: userId,
        processed_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    if (error) return { error: error.message };

    return { success: true, message: "Pago rechazado" };
  } catch (error) {
    console.error('Error rejecting payment:', error);
    return { error: "Error al rechazar el pago" };
  }
}

async function createReimbursement(supabase: any, userId: string, args: any) {
  try {
    const { subject, amount, type, supplier_name, file_paths, account_info } = args;
    
    // Preparar attachments
    const attachments = file_paths.map((path: string) => ({
      path,
      name: path.split('/').pop()
    }));

    // Crear la rendición
    const insertData: any = {
      user_id: userId,
      subject,
      amount,
      type,
      attachments,
      status: 'pending'
    };

    if (type === 'supplier_payment' && supplier_name) {
      insertData.supplier_name = supplier_name;
    }

    // Incluir datos bancarios si se proporcionan
    if (account_info) {
      insertData.account_info = account_info;
    }

    const { data, error } = await supabase
      .from('reimbursements')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating reimbursement:', error);
      return { error: error.message };
    }

    return { 
      success: true, 
      message: `Rendición creada exitosamente con folio ${data.folio}`,
      folio: data.folio,
      reimbursement_id: data.id
    };
  } catch (error) {
    console.error('Error in createReimbursement:', error);
    return { error: "Error al crear la rendición" };
  }
}

async function getStudentsWithDebt(supabase: any) {
  try {
    const { data: students } = await supabase
      .from('students')
      .select('id, name, enrollment_date');

    if (!students) return [];

    const studentsWithDebt = [];
    const monthlyFee = 3000;
    const totalAnnualFee = monthlyFee * 10;

    // Obtener todas las actividades una sola vez
    const { data: activities } = await supabase
      .from('activities')
      .select('id, name, amount');

    for (const student of students) {
      // Calcular deuda de cuotas mensuales
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('student_id', student.id)
        .ilike('concept', 'cuota%');

      const totalPaid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
      const monthlyDebt = Math.max(0, totalAnnualFee - totalPaid);

      // Obtener todas las exclusiones del estudiante
      const { data: exclusions } = await supabase
        .from('activity_exclusions')
        .select('activity_id')
        .eq('student_id', student.id);

      const excludedIds = new Set(exclusions?.map((e: any) => e.activity_id) || []);

      // Obtener todos los pagos del estudiante
      const { data: allPayments } = await supabase
        .from('payments')
        .select('activity_id, concept, amount')
        .eq('student_id', student.id);

      // Calcular deuda de actividades
      let activityDebt = 0;

      for (const activity of activities || []) {
        // Si está excluido, no se considera
        if (excludedIds.has(activity.id)) continue;

        // Verificar si pagó esta actividad (por activity_id o por concepto)
        const hasPaid = allPayments?.some((p: any) => {
          if (p.activity_id === activity.id) return true;
          if (!p.activity_id && p.concept) {
            const normalizedConcept = p.concept.toUpperCase().trim();
            const normalizedActivityName = activity.name.toUpperCase().trim();
            return normalizedConcept.includes(normalizedActivityName) || 
                   normalizedActivityName.includes(normalizedConcept);
          }
          return false;
        }) || false;

        if (!hasPaid) {
          activityDebt += Number(activity.amount);
        }
      }

      const totalDebt = monthlyDebt + activityDebt;

      if (totalDebt > 0) {
        studentsWithDebt.push({
          name: student.name,
          total_debt: totalDebt,
          monthly_debt: monthlyDebt,
          activity_debt: activityDebt
        });
      }
    }

    return studentsWithDebt;
  } catch (error) {
    console.error('Error getting students with debt:', error);
    return [];
  }
}

async function updateScheduledActivity(supabase: any, activityName: string, updates: any) {
  try {
    // Buscar la actividad por nombre
    const { data: activity } = await supabase
      .from('scheduled_activities')
      .select('id')
      .ilike('name', `%${activityName}%`)
      .single();

    if (!activity) return { error: "Actividad no encontrada" };

    const { error } = await supabase
      .from('scheduled_activities')
      .update(updates)
      .eq('id', activity.id);

    if (error) return { error: error.message };

    return { success: true, message: "Actividad actualizada exitosamente" };
  } catch (error) {
    console.error('Error updating scheduled activity:', error);
    return { error: "Error al actualizar la actividad" };
  }
}

async function deleteScheduledActivity(supabase: any, activityName: string) {
  try {
    // Buscar la actividad por nombre
    const { data: activity } = await supabase
      .from('scheduled_activities')
      .select('id')
      .ilike('name', `%${activityName}%`)
      .single();

    if (!activity) return { error: "Actividad no encontrada" };

    const { error } = await supabase
      .from('scheduled_activities')
      .delete()
      .eq('id', activity.id);

    if (error) return { error: error.message };

    return { success: true, message: "Actividad eliminada exitosamente" };
  } catch (error) {
    console.error('Error deleting scheduled activity:', error);
    return { error: "Error al eliminar la actividad" };
  }
}

async function deleteDonationCommitment(supabase: any, activityName: string, studentName: string) {
  try {
    // Buscar la actividad por nombre
    const { data: activity } = await supabase
      .from('scheduled_activities')
      .select('id')
      .ilike('name', `%${activityName}%`)
      .maybeSingle();

    if (!activity) return { error: "Actividad no encontrada" };

    // Buscar el estudiante por nombre
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .ilike('name', `%${studentName}%`)
      .maybeSingle();

    if (!student) return { error: "Estudiante no encontrado" };

    // Eliminar las donaciones del estudiante para esta actividad
    const { error } = await supabase
      .from('activity_donations')
      .delete()
      .eq('scheduled_activity_id', activity.id)
      .eq('student_id', student.id)
      .is('donated_at', null); // Solo eliminar compromisos pendientes

    if (error) return { error: error.message };

    return { success: true, message: "Compromisos de donación eliminados exitosamente" };
  } catch (error) {
    console.error('Error deleting donation commitment:', error);
    return { error: "Error al eliminar compromisos de donación" };
  }
}

async function deleteAllDonationCommitments(supabase: any, activityName: string) {
  try {
    // Buscar la actividad por nombre
    const { data: activity } = await supabase
      .from('scheduled_activities')
      .select('id')
      .ilike('name', `%${activityName}%`)
      .maybeSingle();

    if (!activity) return { error: "Actividad no encontrada" };

    // Eliminar todos los compromisos de donación pendientes para esta actividad
    const { error } = await supabase
      .from('activity_donations')
      .delete()
      .eq('scheduled_activity_id', activity.id)
      .is('donated_at', null); // Solo eliminar compromisos pendientes

    if (error) return { error: error.message };

    return { success: true, message: "Todos los compromisos de donación eliminados exitosamente" };
  } catch (error) {
    console.error('Error deleting all donation commitments:', error);
    return { error: "Error al eliminar compromisos de donación" };
  }
}

async function getBaseDonations(supabase: any, activityName: string) {
  try {
    // Buscar la actividad por nombre
    const { data: activity, error: activityError } = await supabase
      .from('scheduled_activities')
      .select('id, name, is_with_donations')
      .ilike('name', `%${activityName}%`)
      .maybeSingle();

    if (activityError) {
      console.error('Error buscando actividad:', activityError);
      return { error: "Error al buscar la actividad" };
    }

    if (!activity) {
      return { error: "Actividad no encontrada" };
    }

    if (!activity.is_with_donations) {
      return { 
        success: true,
        activity_name: activity.name,
        has_donations: false,
        message: "Esta actividad no tiene donaciones configuradas"
      };
    }

    // Obtener todas las donaciones de la actividad
    const { data: donations, error: donationsError } = await supabase
      .from('activity_donations')
      .select('name, amount, cantidad_original, unit')
      .eq('scheduled_activity_id', activity.id)
      .limit(100);

    if (donationsError) {
      console.error('Error obteniendo donaciones:', donationsError);
      return { error: "Error al obtener las donaciones" };
    }

    if (!donations || donations.length === 0) {
      return {
        success: true,
        activity_name: activity.name,
        has_donations: true,
        items: [],
        message: "La actividad tiene donaciones habilitadas pero no hay items configurados"
      };
    }

    // Agrupar items únicos
    const uniqueItems = new Map();
    donations.forEach((d: any) => {
      const key = `${d.name}_${d.unit}`;
      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, {
          name: d.name,
          cantidad: d.cantidad_original || d.amount,
          unit: d.unit
        });
      }
    });

    const items = Array.from(uniqueItems.values());

    return { 
      success: true, 
      activity_name: activity.name,
      has_donations: true,
      items: items,
      total_items: items.length
    };
  } catch (error) {
    console.error('Error getting base donations:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    return { error: `Error al obtener donaciones: ${errorMsg}` };
  }
}

// ========== NUEVAS FUNCIONES DE CONSULTA ==========

async function getDonationReport(supabase: any, activityName?: string, activityDate?: string) {
  try {
    let query = supabase.from('scheduled_activities').select('id, name, scheduled_date, is_with_donations');
    
    if (activityName) {
      query = query.ilike('name', `%${activityName}%`);
    }
    if (activityDate) {
      query = query.eq('scheduled_date', activityDate);
    }
    
    const { data: activities, error: activityError } = await query.limit(5);
    
    if (activityError || !activities || activities.length === 0) {
      return { error: "No se encontraron actividades" };
    }

    const reports = [];

    for (const activity of activities) {
      if (!activity.is_with_donations) continue;

      // Obtener todas las donaciones de esta actividad
      const { data: donations } = await supabase
        .from('activity_donations')
        .select('id, name, amount, cantidad_original, unit, student_id, donated_at, students(name)')
        .eq('scheduled_activity_id', activity.id);

      if (!donations || donations.length === 0) {
        reports.push({
          activity_name: activity.name,
          activity_date: activity.scheduled_date,
          message: "Sin donaciones configuradas",
          items: [],
          compliance_percentage: 0
        });
        continue;
      }

      // Agrupar por item
      const itemsMap = new Map();
      
      for (const donation of donations) {
        const key = `${donation.name}_${donation.unit}`;
        if (!itemsMap.has(key)) {
          itemsMap.set(key, {
            name: donation.name,
            unit: donation.unit,
            cantidad_original: parseInt(donation.cantidad_original || donation.amount) || 0,
            committed: 0,
            delivered: 0,
            students_committed: [] as Array<{ name: string; amount: string; delivered: boolean }>
          });
        }
        
        const item = itemsMap.get(key);
        if (donation.student_id) {
          const studentName = donation.students?.name || 'Desconocido';
          item.students_committed.push({
            name: studentName,
            amount: donation.amount,
            delivered: !!donation.donated_at
          });
          item.committed += parseInt(donation.amount) || 0;
          if (donation.donated_at) {
            item.delivered += parseInt(donation.amount) || 0;
          }
        }
      }

      const items = Array.from(itemsMap.values()).map(item => ({
        ...item,
        compliance_percentage: item.cantidad_original > 0 
          ? Math.round((item.committed / item.cantidad_original) * 100) 
          : 0
      }));

      const totalOriginal = items.reduce((sum, i) => sum + i.cantidad_original, 0);
      const totalCommitted = items.reduce((sum, i) => sum + i.committed, 0);
      const overallCompliance = totalOriginal > 0 ? Math.round((totalCommitted / totalOriginal) * 100) : 0;

      reports.push({
        activity_name: activity.name,
        activity_date: activity.scheduled_date,
        items,
        compliance_percentage: overallCompliance,
        total_students_committed: new Set(donations.filter((d: any) => d.student_id).map((d: any) => d.student_id)).size
      });
    }

    return { success: true, reports };
  } catch (error) {
    console.error('Error getting donation report:', error);
    return { error: "Error al obtener reporte de donaciones" };
  }
}

async function getMissingDonors(supabase: any, activityName: string) {
  try {
    // Buscar la actividad
    const { data: activity } = await supabase
      .from('scheduled_activities')
      .select('id, name, is_with_donations')
      .ilike('name', `%${activityName}%`)
      .maybeSingle();

    if (!activity) return { error: "Actividad no encontrada" };
    if (!activity.is_with_donations) return { error: "Esta actividad no tiene donaciones" };

    // Obtener todos los estudiantes
    const { data: students } = await supabase
      .from('students')
      .select('id, name')
      .order('name');

    // Obtener exclusiones para esta actividad
    const { data: exclusions } = await supabase
      .from('scheduled_activity_exclusions')
      .select('student_id')
      .eq('scheduled_activity_id', activity.id);

    const excludedIds = new Set(exclusions?.map((e: any) => e.student_id) || []);

    // Obtener estudiantes que ya se comprometieron
    const { data: donations } = await supabase
      .from('activity_donations')
      .select('student_id')
      .eq('scheduled_activity_id', activity.id)
      .not('student_id', 'is', null);

    const committedIds = new Set(donations?.map((d: any) => d.student_id) || []);

    // Filtrar estudiantes que no están excluidos ni comprometidos
    const missingStudents = students?.filter((s: any) => 
      !excludedIds.has(s.id) && !committedIds.has(s.id)
    ) || [];

    // Obtener items disponibles (que no están al 100%)
    const { data: allDonations } = await supabase
      .from('activity_donations')
      .select('name, amount, cantidad_original, unit, student_id')
      .eq('scheduled_activity_id', activity.id);

    const itemsMap = new Map();
    for (const d of allDonations || []) {
      const key = `${d.name}_${d.unit}`;
      if (!itemsMap.has(key)) {
        itemsMap.set(key, {
          name: d.name,
          unit: d.unit,
          cantidad_original: parseInt(d.cantidad_original || d.amount) || 0,
          committed: 0
        });
      }
      if (d.student_id) {
        itemsMap.get(key).committed += parseInt(d.amount) || 0;
      }
    }

    const availableItems = Array.from(itemsMap.values())
      .filter(item => item.committed < item.cantidad_original)
      .map(item => ({
        name: item.name,
        unit: item.unit,
        remaining: item.cantidad_original - item.committed
      }));

    return {
      success: true,
      activity_name: activity.name,
      missing_students: missingStudents.map((s: any) => s.name),
      total_missing: missingStudents.length,
      total_students: students?.length || 0,
      available_items: availableItems
    };
  } catch (error) {
    console.error('Error getting missing donors:', error);
    return { error: "Error al obtener estudiantes sin compromisos" };
  }
}

async function getFormStatus(supabase: any, formTitle: string) {
  try {
    // Buscar el formulario
    const { data: form } = await supabase
      .from('forms')
      .select('id, title, is_active, closes_at, allow_multiple_responses, requires_login')
      .ilike('title', `%${formTitle}%`)
      .maybeSingle();

    if (!form) return { error: "Formulario no encontrado" };

    // Obtener respuestas
    const { data: responses } = await supabase
      .from('form_responses')
      .select('id, student_id, user_id, submitted_at, students(name)')
      .eq('form_id', form.id);

    // Obtener todos los estudiantes
    const { data: students } = await supabase
      .from('students')
      .select('id, name')
      .order('name');

    const respondedStudentIds = new Set(responses?.filter((r: any) => r.student_id).map((r: any) => r.student_id) || []);
    
    const studentsResponded = students?.filter((s: any) => respondedStudentIds.has(s.id)).map((s: any) => s.name) || [];
    const studentsMissing = students?.filter((s: any) => !respondedStudentIds.has(s.id)).map((s: any) => s.name) || [];

    return {
      success: true,
      form_title: form.title,
      is_active: form.is_active,
      closes_at: form.closes_at,
      requires_login: form.requires_login,
      total_responses: responses?.length || 0,
      students_responded: studentsResponded,
      students_missing: studentsMissing,
      response_rate: students?.length > 0 
        ? Math.round((studentsResponded.length / students.length) * 100) 
        : 0
    };
  } catch (error) {
    console.error('Error getting form status:', error);
    return { error: "Error al obtener estado del formulario" };
  }
}

async function searchActivities(supabase: any, searchTerm?: string, dateFrom?: string, dateTo?: string, includeCompleted: boolean = true) {
  try {
    let query = supabase
      .from('scheduled_activities')
      .select('id, name, scheduled_date, is_with_fee, fee_amount, is_with_donations, completed, requires_management')
      .order('scheduled_date', { ascending: false });

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }
    if (dateFrom) {
      query = query.gte('scheduled_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('scheduled_date', dateTo);
    }
    if (!includeCompleted) {
      query = query.eq('completed', false);
    }

    const { data: activities, error } = await query.limit(20);

    if (error) return { error: error.message };

    const results = [];
    for (const activity of activities || []) {
      let donationStatus = null;
      
      if (activity.is_with_donations) {
        const { data: donations } = await supabase
          .from('activity_donations')
          .select('amount, cantidad_original, student_id')
          .eq('scheduled_activity_id', activity.id);

        if (donations && donations.length > 0) {
          const totalOriginal = donations.reduce((sum: number, d: any) => sum + (parseInt(d.cantidad_original) || 0), 0);
          const totalCommitted = donations.filter((d: any) => d.student_id).reduce((sum: number, d: any) => sum + (parseInt(d.amount) || 0), 0);
          donationStatus = {
            compliance_percentage: totalOriginal > 0 ? Math.round((totalCommitted / totalOriginal) * 100) : 0
          };
        }
      }

      results.push({
        name: activity.name,
        date: activity.scheduled_date,
        completed: activity.completed,
        has_fee: activity.is_with_fee,
        fee_amount: activity.fee_amount,
        has_donations: activity.is_with_donations,
        donation_status: donationStatus,
        requires_management: activity.requires_management
      });
    }

    return { success: true, activities: results, total: results.length };
  } catch (error) {
    console.error('Error searching activities:', error);
    return { error: "Error al buscar actividades" };
  }
}

async function getFormSummary(supabase: any, formTitle: string) {
  try {
    // Buscar el formulario
    const { data: form } = await supabase
      .from('forms')
      .select('id, title')
      .ilike('title', `%${formTitle}%`)
      .maybeSingle();

    if (!form) return { error: "Formulario no encontrado" };

    // Obtener campos del formulario
    const { data: fields } = await supabase
      .from('form_fields')
      .select('id, label, field_type, options')
      .eq('form_id', form.id)
      .order('order_index');

    // Obtener todas las respuestas
    const { data: responses } = await supabase
      .from('form_responses')
      .select('response_data')
      .eq('form_id', form.id);

    if (!responses || responses.length === 0) {
      return { 
        success: true, 
        form_title: form.title,
        total_responses: 0,
        summary: []
      };
    }

    // Analizar respuestas por campo
    const summary = [];
    
    for (const field of fields || []) {
      // Solo procesar campos de opción múltiple, checkbox, radio, scale
      if (!['radio', 'checkbox', 'select', 'scale'].includes(field.field_type)) continue;

      const distribution: Record<string, number> = {};
      
      for (const response of responses) {
        const data = response.response_data as Record<string, any>;
        const answer = data[field.id];
        
        if (answer === undefined || answer === null) {
          distribution['Sin respuesta'] = (distribution['Sin respuesta'] || 0) + 1;
        } else if (Array.isArray(answer)) {
          // Checkbox o múltiple selección
          for (const val of answer) {
            distribution[val] = (distribution[val] || 0) + 1;
          }
        } else {
          distribution[String(answer)] = (distribution[String(answer)] || 0) + 1;
        }
      }

      summary.push({
        question: field.label,
        type: field.field_type,
        distribution,
        total_answered: responses.length - (distribution['Sin respuesta'] || 0)
      });
    }

    return {
      success: true,
      form_title: form.title,
      total_responses: responses.length,
      summary
    };
  } catch (error) {
    console.error('Error getting form summary:', error);
    return { error: "Error al obtener resumen del formulario" };
  }
}

// ========== FIN NUEVAS FUNCIONES ==========

async function createBaseDonations(
  supabase: any, 
  activityName: string, 
  donationItems: Array<{name: string, cantidad: string, unit: string}>
) {
  try {
    // Crear cliente de servicio para bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar la actividad
    const { data: activity, error: activityError } = await supabase
      .from('scheduled_activities')
      .select('id, name, is_with_donations')
      .ilike('name', `%${activityName}%`)
      .maybeSingle();

    if (activityError || !activity) {
      return { error: "Actividad no encontrada" };
    }

    if (!activity.is_with_donations) {
      return { error: "Esta actividad no tiene donaciones habilitadas. Primero actualiza la actividad para habilitar donaciones." };
    }

    // Insertar los items de donación base (disponibles para que alumnos se comprometan)
    const donationsToInsert = donationItems.map(item => ({
      scheduled_activity_id: activity.id,
      name: item.name,
      amount: item.cantidad,
      cantidad_original: item.cantidad,
      unit: item.unit,
      student_id: null, // NULL = disponible para comprometerse
      donated_at: null
    }));

    // Usar cliente admin para bypass RLS
    const { error: insertError } = await supabaseAdmin
      .from('activity_donations')
      .insert(donationsToInsert);

    if (insertError) {
      console.error('Error insertando donaciones:', insertError);
      return { error: `Error al crear los items de donación: ${insertError.message}` };
    }

    return {
      success: true,
      message: `Se crearon ${donationItems.length} items de donación disponibles para la actividad "${activity.name}"`,
      activity_name: activity.name,
      items_created: donationItems.length
    };
  } catch (error) {
    console.error('Error creating base donations:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    return { error: `Error al crear donaciones: ${errorMsg}` };
  }
}

async function updateStudent(supabase: any, studentId: number, updates: any) {
  try {
    const { error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', studentId);

    if (error) return { error: error.message };

    return { success: true, message: "Estudiante actualizado exitosamente" };
  } catch (error) {
    console.error('Error updating student:', error);
    return { error: "Error al actualizar el estudiante" };
  }
}

async function updatePayment(supabase: any, paymentId: number, updates: any) {
  try {
    const { error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', paymentId);

    if (error) return { error: error.message };

    return { success: true, message: "Pago actualizado exitosamente" };
  } catch (error) {
    console.error('Error updating payment:', error);
    return { error: "Error al actualizar el pago" };
  }
}

async function deletePayment(supabase: any, paymentId: number) {
  try {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (error) return { error: error.message };

    return { success: true, message: "Pago eliminado exitosamente" };
  } catch (error) {
    console.error('Error deleting payment:', error);
    return { error: "Error al eliminar el pago" };
  }
}

async function updateExpense(supabase: any, expenseId: number, updates: any) {
  try {
    const { error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', expenseId);

    if (error) return { error: error.message };

    return { success: true, message: "Egreso actualizado exitosamente" };
  } catch (error) {
    console.error('Error updating expense:', error);
    return { error: "Error al actualizar el egreso" };
  }
}

async function deleteExpense(supabase: any, expenseId: number) {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (error) return { error: error.message };

    return { success: true, message: "Egreso eliminado exitosamente" };
  } catch (error) {
    console.error('Error deleting expense:', error);
    return { error: "Error al eliminar el egreso" };
  }
}

function getTools(userRole: UserRole) {
  const tools = [];

  if (userRole.role === 'master' || userRole.role === 'admin') {
    tools.push(
      {
        type: "function",
        function: {
          name: "query_student",
          description: "Consulta información de un estudiante por su nombre. Retorna saldo, deudas, pagos pendientes.",
          parameters: {
            type: "object",
            properties: {
              student_name: {
                type: "string",
                description: "Nombre del estudiante a consultar (puede ser parcial)"
              }
            },
            required: ["student_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_donation_report",
          description: "Genera un reporte detallado del estado de donaciones de una o más actividades. Busca por nombre o fecha. Muestra items, cantidades, porcentaje de cumplimiento y quiénes se comprometieron.",
          parameters: {
            type: "object",
            properties: {
              activity_name: { type: "string", description: "Nombre de la actividad (parcial o completo)" },
              activity_date: { type: "string", description: "Fecha de la actividad (YYYY-MM-DD)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_missing_donors",
          description: "Lista los estudiantes que NO tienen compromisos de donación para una actividad específica. También muestra los items que aún tienen espacio disponible.",
          parameters: {
            type: "object",
            properties: {
              activity_name: { type: "string", description: "Nombre de la actividad" }
            },
            required: ["activity_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_form_status",
          description: "Obtiene el estado de respuestas de un formulario: total respuestas, quiénes respondieron, quiénes faltan por responder.",
          parameters: {
            type: "object",
            properties: {
              form_title: { type: "string", description: "Título del formulario (puede ser parcial)" }
            },
            required: ["form_title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_activities",
          description: "Busca actividades programadas por nombre, fecha o rango de fechas. Incluye actividades pasadas y futuras con su estado de donaciones.",
          parameters: {
            type: "object",
            properties: {
              search_term: { type: "string", description: "Término de búsqueda para el nombre" },
              date_from: { type: "string", description: "Fecha inicio del rango (YYYY-MM-DD)" },
              date_to: { type: "string", description: "Fecha fin del rango (YYYY-MM-DD)" },
              include_completed: { type: "boolean", description: "Incluir actividades completadas (default: true)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_form_summary",
          description: "Obtiene un resumen agregado de las respuestas de un formulario, mostrando la distribución de respuestas por pregunta (para preguntas de opción múltiple, checkbox, etc).",
          parameters: {
            type: "object",
            properties: {
              form_title: { type: "string", description: "Título del formulario" }
            },
            required: ["form_title"]
          }
        }
      }
    );
  }

  if (userRole.role === 'master') {
    tools.push(
      {
        type: "function",
        function: {
          name: "get_course_statistics",
          description: "Obtiene estadísticas generales del curso: total estudiantes, ingresos, egresos, balance, deudas.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_upcoming_activities",
          description: "Obtiene las próximas actividades programadas del curso.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_pending_reimbursements",
          description: "Lista los reembolsos y pagos a proveedores pendientes de aprobación.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "register_payment",
          description: "Registra un nuevo pago para un estudiante. Genera automáticamente el folio.",
          parameters: {
            type: "object",
            properties: {
              student_name: { type: "string", description: "Nombre del estudiante" },
              amount: { type: "number", description: "Monto del pago" },
              concept: { type: "string", description: "Concepto del pago (ej: Cuota Marzo, Actividad X)" }
            },
            required: ["student_name", "amount", "concept"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "approve_payment_notification",
          description: "Aprueba una notificación de pago pendiente y la registra como ingreso.",
          parameters: {
            type: "object",
            properties: {
              notification_id: { type: "string", description: "ID de la notificación a aprobar" }
            },
            required: ["notification_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "reject_payment_notification",
          description: "Rechaza una notificación de pago pendiente con un motivo.",
          parameters: {
            type: "object",
            properties: {
              notification_id: { type: "string", description: "ID de la notificación a rechazar" },
              reason: { type: "string", description: "Motivo del rechazo" }
            },
            required: ["notification_id", "reason"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_students_with_debt",
          description: "Lista todos los estudiantes que tienen deudas pendientes (cuotas o actividades).",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "create_reimbursement",
          description: "Crea una nueva rendición o pago a proveedor. SOLO usar cuando el usuario confirme explícitamente todos los datos (monto, asunto, archivos).",
          parameters: {
            type: "object",
            properties: {
              subject: {
                type: "string",
                description: "Asunto o concepto de la rendición"
              },
              amount: {
                type: "number",
                description: "Monto total de la rendición"
              },
              type: {
                type: "string",
                enum: ["reimbursement", "supplier_payment"],
                description: "Tipo de rendición: reimbursement (rendición personal) o supplier_payment (pago a proveedor)"
              },
              supplier_name: {
                type: "string",
                description: "Nombre del proveedor (solo para supplier_payment)"
              },
              file_paths: {
                type: "array",
                items: { type: "string" },
                description: "Rutas de los archivos adjuntos ya subidos al storage"
              },
              account_info: {
                type: "object",
                description: "Datos bancarios extraídos de la imagen (nombre del titular, banco, tipo de cuenta, número de cuenta, RUT, email). Solo para supplier_payment.",
                properties: {
                  holder_name: { type: "string", description: "Nombre del titular de la cuenta" },
                  bank: { type: "string", description: "Nombre del banco" },
                  account_type: { type: "string", description: "Tipo de cuenta (corriente, vista, ahorro)" },
                  account_number: { type: "string", description: "Número de cuenta" },
                  rut: { type: "string", description: "RUT del titular" },
                  email: { type: "string", description: "Email de contacto" }
                }
              }
            },
            required: ["subject", "amount", "type", "file_paths"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_scheduled_activity",
          description: "Crea una nueva actividad programada. Antes de usar esta herramienta, DEBES preguntar UNO POR UNO los siguientes campos: 1) Nombre de la actividad 2) Fecha programada (formato YYYY-MM-DD) 3) ¿Requiere gestión administrativa? (sí/no) 4) ¿Tiene cuota? (sí/no) - Si sí: ¿Cuánto es la cuota? 5) ¿Tiene donaciones? (sí/no) - Si sí: Pedir lista de items con nombre, cantidad y unidad. SOLO ejecutar cuando tengas TODOS los datos confirmados.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre de la actividad" },
              scheduled_date: { type: "string", description: "Fecha programada (YYYY-MM-DD)" },
              requires_management: { type: "boolean", description: "Si requiere gestión administrativa" },
              is_with_fee: { type: "boolean", description: "Si tiene cuota asociada" },
              fee_amount: { type: "number", description: "Monto de la cuota (solo si is_with_fee es true)" },
              is_with_donations: { type: "boolean", description: "Si requiere donaciones" },
              donation_items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Nombre del item a donar" },
                    amount: { type: "string", description: "Cantidad requerida" },
                    unit: { type: "string", description: "Unidad de medida (gramos, kg, litros, ml, unidades, paquetes, cajas, bolsas, metros, otros)" }
                  },
                  required: ["name", "amount", "unit"]
                },
                description: "Lista de items de donación (solo si is_with_donations es true)"
              }
            },
            required: ["name", "scheduled_date", "requires_management", "is_with_fee", "is_with_donations"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_scheduled_activity",
          description: "Actualiza una actividad programada existente buscándola por nombre. Pide confirmación antes de ejecutar.",
          parameters: {
            type: "object",
            properties: {
              activity_name: { type: "string", description: "Nombre de la actividad a actualizar (puede ser parcial)" },
              updates: {
                type: "object",
                description: "Campos a actualizar (name, scheduled_date, requires_management, is_with_fee, fee_amount, completed)",
                properties: {
                  name: { type: "string" },
                  scheduled_date: { type: "string" },
                  requires_management: { type: "boolean" },
                  is_with_fee: { type: "boolean" },
                  fee_amount: { type: "number" },
                  completed: { type: "boolean" }
                }
              }
            },
            required: ["activity_name", "updates"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_scheduled_activity",
          description: "Elimina una actividad programada buscándola por nombre. Pide confirmación antes de ejecutar.",
          parameters: {
            type: "object",
            properties: {
              activity_name: { type: "string", description: "Nombre de la actividad a eliminar (puede ser parcial)" }
            },
            required: ["activity_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_base_donations",
          description: "Obtiene la lista de items de donación base configurados para una actividad programada",
          parameters: {
            type: "object",
            properties: {
              activity_name: { type: "string", description: "Nombre de la actividad programada" }
            },
            required: ["activity_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_base_donations",
          description: "Crea items de donación base (disponibles) para una actividad programada existente. NO crea registros por alumno, solo crea los items base que quedarán disponibles para que los alumnos se comprometan.",
          parameters: {
            type: "object",
            properties: {
              activity_name: { 
                type: "string", 
                description: "Nombre de la actividad programada a la que se agregarán las donaciones" 
              },
              donation_items: {
                type: "array",
                description: "Lista de items de donación a crear",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Nombre del item (ej: 'Azúcar')" },
                    cantidad: { type: "string", description: "Cantidad requerida (ej: '200')" },
                    unit: { type: "string", description: "Unidad de medida (ej: 'gramos', 'litros', 'unidades')" }
                  },
                  required: ["name", "cantidad", "unit"]
                }
              }
            },
            required: ["activity_name", "donation_items"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_donation_commitment",
          description: "Elimina los compromisos de donación de un estudiante específico para una actividad. Pide confirmación antes de ejecutar.",
          parameters: {
            type: "object",
            properties: {
              activity_name: { type: "string", description: "Nombre de la actividad (puede ser parcial)" },
              student_name: { type: "string", description: "Nombre del estudiante (puede ser parcial)" }
            },
            required: ["activity_name", "student_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_all_donation_commitments",
          description: "Elimina TODOS los compromisos de donación de una actividad (para todos los estudiantes). Pide confirmación antes de ejecutar.",
          parameters: {
            type: "object",
            properties: {
              activity_name: { type: "string", description: "Nombre de la actividad (puede ser parcial)" }
            },
            required: ["activity_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_student",
          description: "Actualiza datos de un estudiante existente. Pide confirmación antes de ejecutar.",
          parameters: {
            type: "object",
            properties: {
              student_id: { type: "number", description: "ID del estudiante a actualizar" },
              updates: {
                type: "object",
                description: "Campos a actualizar (name, enrollment_date)",
                properties: {
                  name: { type: "string" },
                  enrollment_date: { type: "string" }
                }
              }
            },
            required: ["student_id", "updates"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_payment",
          description: "Actualiza un pago registrado. Pide confirmación antes de ejecutar.",
          parameters: {
            type: "object",
            properties: {
              payment_id: { type: "number", description: "ID del pago a actualizar" },
              updates: {
                type: "object",
                description: "Campos a actualizar (amount, concept, payment_date)",
                properties: {
                  amount: { type: "number" },
                  concept: { type: "string" },
                  payment_date: { type: "string" }
                }
              }
            },
            required: ["payment_id", "updates"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_payment",
          description: "Elimina un pago registrado. Pide confirmación antes de ejecutar.",
          parameters: {
            type: "object",
            properties: {
              payment_id: { type: "number", description: "ID del pago a eliminar" }
            },
            required: ["payment_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_expense",
          description: "Actualiza un egreso registrado. Pide confirmación antes de ejecutar.",
          parameters: {
            type: "object",
            properties: {
              expense_id: { type: "number", description: "ID del egreso a actualizar" },
              updates: {
                type: "object",
                description: "Campos a actualizar (amount, concept, expense_date, supplier)",
                properties: {
                  amount: { type: "number" },
                  concept: { type: "string" },
                  expense_date: { type: "string" },
                  supplier: { type: "string" }
                }
              }
            },
            required: ["expense_id", "updates"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_expense",
          description: "Elimina un egreso registrado. Pide confirmación antes de ejecutar.",
          parameters: {
            type: "object",
            properties: {
              expense_id: { type: "number", description: "ID del egreso a eliminar" }
            },
            required: ["expense_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "suggest_module",
          description: "Sugiere el módulo apropiado del sistema cuando el usuario necesite generar reportes PDF, certificados, o acceder a funcionalidad específica. Retorna el nombre del módulo y su ruta.",
          parameters: {
            type: "object",
            properties: {
              module_name: {
                type: "string",
                description: "Nombre del módulo sugerido",
                enum: ["Informes de Deudas", "Informes de Pagos", "Balance", "Ingresos", "Egresos", "Gestión de Créditos", "Movimientos de Crédito", "Pagos y Devoluciones", "Notificaciones de Pago", "Actividades Programadas", "Estudiantes", "Perfil del Estudiante"]
              },
              reason: {
                type: "string",
                description: "Breve explicación de por qué este módulo es el apropiado para la necesidad del usuario"
              }
            },
            required: ["module_name", "reason"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_donation_report",
          description: "Genera un reporte detallado del estado de donaciones de una o más actividades. Busca por nombre o fecha. Muestra items, cantidades, porcentaje de cumplimiento y quiénes se comprometieron.",
          parameters: {
            type: "object",
            properties: {
              activity_name: { type: "string", description: "Nombre de la actividad (parcial o completo)" },
              activity_date: { type: "string", description: "Fecha de la actividad (YYYY-MM-DD)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_missing_donors",
          description: "Lista los estudiantes que NO tienen compromisos de donación para una actividad específica. También muestra los items que aún tienen espacio disponible.",
          parameters: {
            type: "object",
            properties: {
              activity_name: { type: "string", description: "Nombre de la actividad" }
            },
            required: ["activity_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_form_status",
          description: "Obtiene el estado de respuestas de un formulario: total respuestas, quiénes respondieron, quiénes faltan por responder.",
          parameters: {
            type: "object",
            properties: {
              form_title: { type: "string", description: "Título del formulario (puede ser parcial)" }
            },
            required: ["form_title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_activities",
          description: "Busca actividades programadas por nombre, fecha o rango de fechas. Incluye actividades pasadas y futuras con su estado de donaciones.",
          parameters: {
            type: "object",
            properties: {
              search_term: { type: "string", description: "Término de búsqueda para el nombre" },
              date_from: { type: "string", description: "Fecha inicio del rango (YYYY-MM-DD)" },
              date_to: { type: "string", description: "Fecha fin del rango (YYYY-MM-DD)" },
              include_completed: { type: "boolean", description: "Incluir actividades completadas (default: true)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_form_summary",
          description: "Obtiene un resumen agregado de las respuestas de un formulario, mostrando la distribución de respuestas por pregunta (para preguntas de opción múltiple, checkbox, etc).",
          parameters: {
            type: "object",
            properties: {
              form_title: { type: "string", description: "Título del formulario" }
            },
            required: ["form_title"]
          }
        }
      }
    );
  }

  return tools;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, files } = await req.json();
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Crear cliente de Supabase con el token del usuario
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { Authorization: authHeader } 
        } 
      }
    );

    let userId: string;
    try {
      const token = authHeader.replace('Bearer', '').trim();
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) throw new Error('Token inválido');
      const payloadJson = atob(tokenParts[1]);
      const payload = JSON.parse(payloadJson);
      userId = payload.sub as string;
      if (!userId) throw new Error('Sin sub en token');
    } catch (e) {
      console.error('Error decodificando JWT del usuario:', e);
      throw new Error('Usuario no autenticado');
    }

    const userRole = await getUserRole(userId, supabaseClient);
    if (!userRole) throw new Error("Usuario sin rol asignado");
 
    let studentData: StudentData | null = null;
    if (userRole.role === 'alumnos') {
      studentData = await getStudentData(userId, supabaseClient);
    }

    const systemPrompt = getSystemPrompt(userRole, studentData);
    const tools = getTools(userRole);

    // Preparar mensajes con archivos como contenido multimodal
    let processedMessages = [...messages];
    
    if (files && files.length > 0) {
      // Convertir archivos a formato de contenido multimodal para Gemini
      const fileContents = files.map((file: any) => {
        return {
          type: "image_url" as const,
          image_url: {
            url: file.data // Data URL: "data:image/jpeg;base64,..."
          }
        };
      });

      // Agregar los archivos al último mensaje del usuario
      const lastMessage = processedMessages[processedMessages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        const textContent = typeof lastMessage.content === 'string' 
          ? lastMessage.content 
          : '';
        
        // Para pagos a proveedor, instruir al modelo a extraer datos bancarios
        const instructionText = textContent || `Analiza estos ${files.length} documento(s) adjunto(s). Si es un pago a proveedor, extrae los datos bancarios (nombre del titular, banco, tipo de cuenta, número de cuenta, RUT, email) y el monto total. Si es una rendición, solo extrae el monto.`;
        
        processedMessages[processedMessages.length - 1] = {
          ...lastMessage,
          content: [
            {
              type: "text" as const,
              text: instructionText
            },
            ...fileContents
          ]
        };
      }
    }

    // Primera llamada al AI - sin streaming para poder procesar tool calls
    let requestBody: any = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        ...processedMessages,
      ],
      stream: false,
    };

    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta nuevamente más tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Se requiere pago. Contacta al administrador del sistema." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Error en el servicio de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let aiResponse = await response.json();
    
    // Loop para procesar tool calls hasta que el AI de una respuesta final
    while (aiResponse.choices?.[0]?.message?.tool_calls) {
      const toolCalls = aiResponse.choices[0].message.tool_calls;
      const toolResults = [];
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let result: any;

        switch (functionName) {
          case 'query_student':
            result = await queryStudentByName(args.student_name, supabaseClient);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result || { error: "Estudiante no encontrado" })
            });
            break;

          case 'get_course_statistics':
            result = await getCourseStatistics(supabaseClient);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result || { error: "Error al obtener estadísticas" })
            });
            break;

          case 'get_upcoming_activities':
            result = await getUpcomingActivities(supabaseClient);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ activities: result })
            });
            break;

          case 'get_pending_reimbursements':
            result = await getPendingReimbursements(supabaseClient);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ reimbursements: result })
            });
            break;

          case 'register_payment':
            result = await registerPayment(supabaseClient, args, userId);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'approve_payment_notification':
            result = await approvePaymentNotification(supabaseClient, args.notification_id, userId);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'reject_payment_notification':
            result = await rejectPaymentNotification(supabaseClient, args.notification_id, userId, args.reason);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'get_students_with_debt':
            result = await getStudentsWithDebt(supabaseClient);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ students: result })
            });
            break;

          case 'suggest_module':
            const moduleMap: Record<string, string> = {
              "Informes de Deudas": "/debt-reports",
              "Informes de Pagos": "/payment-reports",
              "Balance": "/balance",
              "Ingresos": "/income",
              "Egresos": "/expenses",
              "Gestión de Créditos": "/credit-management",
              "Movimientos de Crédito": "/credit-movements",
              "Pagos y Devoluciones": "/reimbursements",
              "Notificaciones de Pago": "/payment-notifications",
              "Actividades Programadas": "/scheduled-activities",
              "Estudiantes": "/students",
              "Perfil del Estudiante": "/student-profile"
            };
            
            result = {
              module: args.module_name,
              path: moduleMap[args.module_name] || "/",
              reason: args.reason
            };
            
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'create_reimbursement':
            result = await createReimbursement(supabaseClient, userId, args);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'create_scheduled_activity':
            try {
              let activityId = null;

              // Si es con cuota, crear primero en la tabla activities
              if (args.is_with_fee && args.fee_amount) {
                const { data: activityData, error: activityError } = await supabaseClient
                  .from('activities')
                  .insert({
                    name: args.name,
                    amount: args.fee_amount,
                    activity_date: args.scheduled_date,
                  })
                  .select()
                  .single();

                if (activityError) throw activityError;
                activityId = activityData.id;
              }

              // Crear la actividad programada
              const { data: activity, error: scheduledError } = await supabaseClient
                .from('scheduled_activities')
                .insert({
                  name: args.name,
                  scheduled_date: args.scheduled_date,
                  requires_management: args.requires_management,
                  is_with_fee: args.is_with_fee,
                  fee_amount: args.is_with_fee ? args.fee_amount : null,
                  is_with_donations: args.is_with_donations,
                  activity_id: activityId,
                  created_by: userId
                })
                .select()
                .single();

              if (scheduledError) throw scheduledError;

              // Si tiene donaciones, crear SOLO los items base (student_id: null)
              // Los estudiantes luego se comprometerán con estos items base
              if (args.is_with_donations && args.donation_items && args.donation_items.length > 0) {
                const donationRecords = args.donation_items.map((item: any) => ({
                  scheduled_activity_id: activity.id,
                  student_id: null, // Registro base sin asignar a ningún estudiante
                  name: item.name,
                  amount: item.amount, // Cantidad disponible actual
                  cantidad_original: item.amount, // Cantidad original solicitada
                  unit: item.unit,
                  donated_at: null
                }));

                const { error: donationsError } = await supabaseClient
                  .from('activity_donations')
                  .insert(donationRecords);

                if (donationsError) throw donationsError;
              }

              result = {
                success: true,
                message: `Actividad "${args.name}" creada exitosamente para el ${args.scheduled_date}`,
                activity_id: activity.id
              };
            } catch (error: any) {
              console.error('Error creating scheduled activity:', error);
              result = {
                success: false,
                error: error.message || "Error al crear la actividad"
              };
            }

            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'update_scheduled_activity':
            result = await updateScheduledActivity(supabaseClient, args.activity_name, args.updates);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'delete_scheduled_activity':
            result = await deleteScheduledActivity(supabaseClient, args.activity_name);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'delete_donation_commitment':
            result = await deleteDonationCommitment(supabaseClient, args.activity_name, args.student_name);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'delete_all_donation_commitments':
            result = await deleteAllDonationCommitments(supabaseClient, args.activity_name);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'update_student':
            result = await updateStudent(supabaseClient, args.student_id, args.updates);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'update_payment':
            result = await updatePayment(supabaseClient, args.payment_id, args.updates);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'delete_payment':
            result = await deletePayment(supabaseClient, args.payment_id);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'update_expense':
            result = await updateExpense(supabaseClient, args.expense_id, args.updates);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'delete_expense':
            result = await deleteExpense(supabaseClient, args.expense_id);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'get_base_donations':
            result = await getBaseDonations(supabaseClient, args.activity_name);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'create_base_donations':
            result = await createBaseDonations(
              supabaseClient, 
              args.activity_name,
              args.donation_items
            );
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'get_donation_report':
            result = await getDonationReport(supabaseClient, args.activity_name, args.activity_date);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'get_missing_donors':
            result = await getMissingDonors(supabaseClient, args.activity_name);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'get_form_status':
            result = await getFormStatus(supabaseClient, args.form_title);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'search_activities':
            result = await searchActivities(supabaseClient, args.search_term, args.date_from, args.date_to, args.include_completed ?? true);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;

          case 'get_form_summary':
            result = await getFormSummary(supabaseClient, args.form_title);
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            break;
        }
      }
      
      // Agregar el mensaje del asistente con tool_calls y los resultados
      processedMessages.push(aiResponse.choices[0].message);
      processedMessages.push(...toolResults);

      // Nueva llamada con los resultados
      requestBody = {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...processedMessages,
        ],
        stream: false,
      };

      if (tools.length > 0) {
        requestBody.tools = tools;
      }

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("AI gateway error on tool response:", response.status, text);
        return new Response(JSON.stringify({ error: "Error procesando herramientas" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      aiResponse = await response.json();
    }

    // Ahora que tenemos la respuesta final, devolver el contenido como JSON
    const finalMessage = aiResponse.choices?.[0]?.message;
    const content = typeof finalMessage?.content === "string" ? finalMessage.content : "";

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
