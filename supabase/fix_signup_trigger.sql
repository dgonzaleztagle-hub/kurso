-- Fix 500 Error on Signup
-- Problem: 'whatsapp_number' was UNIQUE NOT NULL, defaulting to empty string on signup.
-- This caused collision on the second user signed up without a phone number.

-- 1. Relax Constraint
ALTER TABLE public.app_users ALTER COLUMN whatsapp_number DROP NOT NULL;

-- 2. Update Trigger Function to use NULL instead of empty string
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.app_users (id, email, whatsapp_number, full_name)
  VALUES (
    new.id, 
    new.email, 
    NULLIF(new.raw_user_meta_data->>'whatsapp', ''), -- Use NULL if empty or missing
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cleanup existing empty strings to NULL to avoid future unique conflicts if unique index persists
UPDATE public.app_users SET whatsapp_number = NULL WHERE whatsapp_number = '';
