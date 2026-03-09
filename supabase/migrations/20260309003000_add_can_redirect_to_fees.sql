ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS can_redirect_to_fees boolean NOT NULL DEFAULT false;