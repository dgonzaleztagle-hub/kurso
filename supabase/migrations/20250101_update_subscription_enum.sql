-- Add new values to subscription_status enum
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'grace_period';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'locked';
