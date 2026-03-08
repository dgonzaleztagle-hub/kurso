-- ============================================================
-- Prevent duplicate student RUTs (global)
-- Date: 2026-03-08
-- ============================================================

CREATE OR REPLACE FUNCTION public.tr_prevent_duplicate_student_rut()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rut_norm TEXT;
BEGIN
  IF NEW.rut IS NULL OR btrim(NEW.rut) = '' THEN
    RETURN NEW;
  END IF;

  v_rut_norm := upper(regexp_replace(NEW.rut, '[^0-9kK]', '', 'g'));

  IF EXISTS (
    SELECT 1
    FROM public.students s
    WHERE upper(regexp_replace(s.rut, '[^0-9kK]', '', 'g')) = v_rut_norm
      AND (TG_OP = 'INSERT' OR s.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Ya existe un alumno con ese RUT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_duplicate_student_rut ON public.students;
CREATE TRIGGER tr_prevent_duplicate_student_rut
BEFORE INSERT OR UPDATE OF rut ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.tr_prevent_duplicate_student_rut();
