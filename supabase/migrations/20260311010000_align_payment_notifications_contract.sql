-- Normalize payment_notifications to the contract already used by the app.
-- Keep legacy submitted_by/voucher_url fields for backwards compatibility.

ALTER TABLE public.payment_notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.app_users(id),
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS bank text,
  ADD COLUMN IF NOT EXISTS payment_details jsonb,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES public.app_users(id),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.payment_notifications
SET user_id = submitted_by
WHERE user_id IS NULL
  AND submitted_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_notifications_user_id
  ON public.payment_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_notifications_submitted_by
  ON public.payment_notifications(submitted_by);
