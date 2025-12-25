-- ==============================================================================
-- INSTALACIÓN DE LÓGICA DE MIGRACIÓN V4 (Fix Schema: replace 'status' with 'is_active')
-- ==============================================================================
-- 1. Eliminar la versión anterior defectuosa (si existe)
DROP FUNCTION IF EXISTS public.migrate_course_year(uuid,text,integer,numeric,uuid[],jsonb[]);

-- 2. Crear la nueva versión corregida (V4 con p_ y corrección de columnas)
CREATE OR REPLACE FUNCTION public.migrate_course_year(
    p_previous_tenant_id uuid,
    p_new_name text,
    p_new_fiscal_year integer,
    p_new_fee_amount numeric,
    p_admin_ids uuid[],
    p_student_data jsonb[] 
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_tenant_id uuid;
    v_old_tenant_org_id uuid;
    v_old_tenant_owner_id uuid;
    s_data jsonb;
    v_new_student_id uuid;
    
    result_json json;
    activity_id uuid;
BEGIN
    -- 1. Obtener info del tenant anterior
    SELECT organization_id, owner_id INTO v_old_tenant_org_id, v_old_tenant_owner_id
    FROM public.tenants WHERE id = p_previous_tenant_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant anterior no encontrado';
    END IF;

    -- 2. Crear Nuevo Tenant
    INSERT INTO public.tenants (
        name, 
        organization_id, 
        owner_id, 
        status, 
        fiscal_year, 
        previous_tenant_id, 
        subscription_status,
        settings
    ) VALUES (
        p_new_name,
        v_old_tenant_org_id,
        v_old_tenant_owner_id,
        'active',
        p_new_fiscal_year,
        p_previous_tenant_id, 
        'active', 
        jsonb_build_object('monthly_fee', p_new_fee_amount)
    ) RETURNING id INTO v_new_tenant_id;

    -- Enlazar tenant viejo con el nuevo
    UPDATE public.tenants 
    SET next_tenant_id = v_new_tenant_id 
    WHERE id = p_previous_tenant_id;

    -- 3. Migrar Administradores
    INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
    SELECT v_new_tenant_id, tm.user_id, tm.role, 'active'
    FROM public.tenant_members tm
    WHERE tm.tenant_id = p_previous_tenant_id
    AND (
        (tm.role = 'owner') OR 
        (tm.user_id = ANY(p_admin_ids))
    )
    ON CONFLICT DO NOTHING;

    -- 4. Migrar Estudiantes (Loop)
    FOREACH s_data IN ARRAY p_student_data
    LOOP
        -- A. Crear Estudiante
        -- CORRECCIÓN V4: Usar 'is_active' en lugar de 'status'
        INSERT INTO public.students (
            tenant_id, first_name, last_name, rut, enrollment_date, is_active
        ) VALUES (
            v_new_tenant_id, 
            s_data->>'first_name', 
            s_data->>'last_name', 
            s_data->>'rut', 
            make_date(p_new_fiscal_year, 3, 1),
            true -- is_active = true
        ) RETURNING id INTO v_new_student_id;

        -- B. Manejar Deuda
        IF (s_data->>'rollover_debt')::numeric > 0 THEN
             INSERT INTO public.activities (
                tenant_id, name, amount, activity_date, is_published, description
            ) VALUES (
                 v_new_tenant_id,
                 'Saldo Pendiente ' || (p_new_fiscal_year - 1)::text || ' (' || (s_data->>'last_name') || ')',
                 (s_data->>'rollover_debt')::numeric,
                 make_date(p_new_fiscal_year, 3, 1),
                 true,
                 'Deuda arrastrada del año anterior'
            ) RETURNING id INTO activity_id;
        END IF;

        -- C. Manejar Crédito
        IF (s_data->>'rollover_credit')::numeric > 0 THEN
             INSERT INTO public.credit_movements (
                tenant_id,
                student_id,
                amount,
                type,
                description,
                created_at
            ) VALUES (
                v_new_tenant_id,
                v_new_student_id,
                (s_data->>'rollover_credit')::numeric,
                'deposit',
                'Saldo a favor año anterior',
                now()
            );
        END IF;

    END LOOP;

    result_json := json_build_object('new_tenant_id', v_new_tenant_id);
    RETURN result_json;
END;
$$;
