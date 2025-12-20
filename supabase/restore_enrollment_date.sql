-- Restore enrollment_date column to students table
-- Critical for retroactive debt calculation (e.g. students enrolled in Feb but registered in System in May)

-- 1. Add column with default to current date (safe for new records)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS enrollment_date DATE DEFAULT CURRENT_DATE;

-- 2. Backfill existing records using their created_at date (best guess for current data)
UPDATE public.students 
SET enrollment_date = created_at::DATE 
WHERE enrollment_date IS NULL;

-- 3. Make it NOT NULL to enforce data integrity going forward
ALTER TABLE public.students ALTER COLUMN enrollment_date SET NOT NULL;
