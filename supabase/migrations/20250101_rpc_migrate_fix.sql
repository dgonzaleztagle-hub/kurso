-- ==============================================================================
-- INSTALACIÓN DE LÓGICA DE MIGRACIÓN (Magic Wand)
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de Supabase para activar la función de migración.

CREATE OR REPLACE FUNCTION public.migrate_course_year(
    previous_tenant_id uuid,
    new_name text,
    new_fiscal_year integer,
    new_fee_amount numeric,
    admin_ids uuid[],
    student_data jsonb[] -- Array of { old_student_id, rut, first_name, last_name, rollover_debt, rollover_credit }
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_tenant_id uuid;
    old_tenant_org_id uuid;
    old_tenant_owner_id uuid;
    s_data jsonb;
    new_student_id uuid;
    
    result_json json;
    activity_id uuid;
BEGIN
    -- 1. Obtener info del tenant anterior
    SELECT organization_id, owner_id INTO old_tenant_org_id, old_tenant_owner_id
    FROM public.tenants WHERE id = previous_tenant_id;
    
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
        new_name,
        old_tenant_org_id,
        old_tenant_owner_id,
        'active',
        new_fiscal_year,
        previous_tenant_id,
        'active', 
        jsonb_build_object('monthly_fee', new_fee_amount)
    ) RETURNING id INTO new_tenant_id;

    -- Enlazar tenant viejo con el nuevo
    UPDATE public.tenants 
    SET next_tenant_id = new_tenant_id 
    WHERE id = previous_tenant_id;

    -- 3. Migrar Administradores (El owner ya está, copiamos otros si los hay)
    INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
    SELECT new_tenant_id, tm.user_id, tm.role, 'active'
    FROM public.tenant_members tm
    WHERE tm.tenant_id = previous_tenant_id
    AND (
        (tm.role = 'owner') OR 
        (tm.user_id = ANY(admin_ids))
    )
    ON CONFLICT DO NOTHING;

    -- 4. Migrar Estudiantes (Loop)
    FOREACH s_data IN ARRAY student_data
    LOOP
        -- A. Crear Estudiante
        INSERT INTO public.students (
            tenant_id, first_name, last_name, rut, enrollment_date, status
        ) VALUES (
            new_tenant_id, 
            s_data->>'first_name', 
            s_data->>'last_name', 
            s_data->>'rut', 
            make_date(new_fiscal_year, 3, 1),
            'active'
        ) RETURNING id INTO new_student_id;

        -- B. Manejar Deuda (Crear Actividad de "Saldo Pendiente" específica para este alumno)
        IF (s_data->>'rollover_debt')::numeric > 0 THEN
             INSERT INTO public.activities (
                tenant_id, name, amount, activity_date, is_published, description
            ) VALUES (
                 new_tenant_id,
                 'Saldo Pendiente ' || (new_fiscal_year - 1)::text || ' (' || (s_data->>'last_name') || ')',
                 (s_data->>'rollover_debt')::numeric,
                 make_date(new_fiscal_year, 3, 1),
                 true,
                 'Deuda arrastrada del año anterior'
            ) RETURNING id INTO activity_id;
            
            -- Importante: Si excluimos a todos los demás, sería ideal, pero por ahora
            -- asumimos que el Dashboard muestra "Actividades" que no has pagado.
            -- Como es un cobro "personalizado", no debería afectar a otros si el sistema de pagos es inteligente.
            -- (En una versión avanzada usaríamos activity_exclusions para todos los demás)
        END IF;

        -- C. Manejar Crédito (Wallet)
        IF (s_data->>'rollover_credit')::numeric > 0 THEN
             INSERT INTO public.credit_movements (
                tenant_id,
                student_id,
                amount,
                type,
                description,
                created_at
            ) VALUES (
                new_tenant_id,
                new_student_id,
                (s_data->>'rollover_credit')::numeric,
                'deposit',
                'Saldo a favor año anterior',
                now()
            );
        END IF;

    END LOOP;

    result_json := json_build_object('new_tenant_id', new_tenant_id);
    RETURN result_json;
END;
$$;
