-- STEP 3: Crear nuevo estudiante (reemplaza 85f4cd1e-7d85-4543-8456-4c9ebb5dfe99 con el tenant ID)
-- El trigger automáticamente creará la cuenta en auth.users con @estudiantes.kurso
INSERT INTO students (rut, first_name, last_name, tenant_id)
VALUES ('20333444-5', 'Test', 'Estudiante', '85f4cd1e-7d85-4543-8456-4c9ebb5dfe99')
RETURNING id, rut, first_name;
