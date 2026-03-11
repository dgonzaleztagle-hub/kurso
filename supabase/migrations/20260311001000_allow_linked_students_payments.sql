-- Allow linked student users to read their own payments and manage their own
-- payment notifications without exposing tenant-wide finance data.

DROP POLICY IF EXISTS "Linked students can view own payments" ON public.payments;
CREATE POLICY "Linked students can view own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_students us
    WHERE us.user_id = auth.uid()
      AND us.student_id = payments.student_id
  )
);

DROP POLICY IF EXISTS "Linked students can view own payment notifications" ON public.payment_notifications;
CREATE POLICY "Linked students can view own payment notifications"
ON public.payment_notifications
FOR SELECT
TO authenticated
USING (
  submitted_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_students us
    WHERE us.user_id = auth.uid()
      AND us.student_id = payment_notifications.student_id
  )
);

DROP POLICY IF EXISTS "Linked students can create own payment notifications" ON public.payment_notifications;
CREATE POLICY "Linked students can create own payment notifications"
ON public.payment_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.user_students us
    JOIN public.students s ON s.id = us.student_id
    WHERE us.user_id = auth.uid()
      AND us.student_id = payment_notifications.student_id
      AND s.tenant_id = payment_notifications.tenant_id
  )
);
