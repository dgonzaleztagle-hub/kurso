-- Add RUT column to students table
-- First add it as nullable to avoid issues with existing data
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS rut text;

-- Create a unique index for RUT (insuring uniqueness but allowing nulls for legacy data effectively if needed, though UNIQUE constraint standard allows multiple NULLs in Postgres)
-- Using a partial index to ensure clean unique values only for non-null ruts
CREATE UNIQUE INDEX IF NOT EXISTS students_rut_unique_idx ON public.students (rut) WHERE rut IS NOT NULL;

-- Comment on column
COMMENT ON COLUMN public.students.rut IS 'RUT of the student, formatted as 12345678-9. Used for account generation.';
