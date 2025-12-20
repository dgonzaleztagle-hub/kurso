-- DESACTIVAR TRIGGERS DE NOTIFICACIONES
-- Estos triggers llaman a edge functions que requieren Twilio/Resend

-- Eliminar trigger de notificación de pago (usa Resend email)
DROP TRIGGER IF EXISTS on_payment_notification_submitted ON public.payment_notifications;

-- Eliminar trigger de cambio de estado de rendición (usa Twilio SMS)
DROP TRIGGER IF EXISTS on_reimbursement_status_change ON public.reimbursements;

-- Eliminar trigger de nueva rendición (usa Twilio SMS)
DROP TRIGGER IF EXISTS on_new_reimbursement ON public.reimbursements;

-- Eliminar trigger de pago a proveedor (usa Twilio SMS)
DROP TRIGGER IF EXISTS on_supplier_payment_created ON public.reimbursements;

-- NOTA: Las funciones de base de datos se mantienen para poder reactivar fácilmente
-- Solo se eliminan los triggers que disparan las notificaciones

-- Comentario para reactivar en el futuro:
-- CREATE TRIGGER on_payment_notification_submitted
--   AFTER INSERT ON public.payment_notifications
--   FOR EACH ROW EXECUTE FUNCTION notify_payment_submission();

-- CREATE TRIGGER on_reimbursement_status_change
--   AFTER UPDATE ON public.reimbursements
--   FOR EACH ROW EXECUTE FUNCTION notify_reimbursement_status_change();

-- CREATE TRIGGER on_new_reimbursement
--   AFTER INSERT ON public.reimbursements
--   FOR EACH ROW
--   WHEN (NEW.type = 'reimbursement')
--   EXECUTE FUNCTION notify_new_reimbursement();

-- CREATE TRIGGER on_supplier_payment_created
--   AFTER INSERT ON public.reimbursements
--   FOR EACH ROW
--   WHEN (NEW.type = 'supplier_payment')
--   EXECUTE FUNCTION notify_supplier_payment_created();