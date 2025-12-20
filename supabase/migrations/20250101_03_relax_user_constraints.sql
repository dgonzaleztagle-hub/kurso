-- Relax whatsapp_number constraint to allow initial creation by trigger with empty/null
-- This enables the 2-step flow: Signup (Auth) -> Onboarding (Profile Completion)

ALTER TABLE public.app_users ALTER COLUMN whatsapp_number DROP NOT NULL;

-- Remove the unique constraint if it exists on the empty string or generally, 
-- but we probably want to keep it unique for ACTUAL numbers.
-- Strategy: Use a partial unique index instead if needed, but for now just dropping NOT NULL is key.
-- If existing rows have '', they are fine. If new rows come as NULL, they are fine.
-- The trigger currently inserts `COALESCE(meta->>'whatsapp', '')`. We should probably change trigger too,
-- but dropping NOT NULL protects against 'failed to be not null' error if trigger logic changes.

-- OPTIONAL: If we want to allow multiple users with NULL/Empty whatsapp (ghost users pending onboarding)
-- we might need to drop the UNIQUE constraint or make it Partial (WHERE whatsapp_number IS NOT NULL AND whatsapp_number <> '').
-- Checking exisiting constraints to be safe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_users_whatsapp_number_key') THEN
    ALTER TABLE public.app_users DROP CONSTRAINT app_users_whatsapp_number_key;
  END IF;
END $$;

-- Re-create unique index only for valid numbers
CREATE UNIQUE INDEX IF NOT EXISTS app_users_whatsapp_number_unique_idx 
ON public.app_users (whatsapp_number) 
WHERE whatsapp_number IS NOT NULL AND whatsapp_number <> '';
