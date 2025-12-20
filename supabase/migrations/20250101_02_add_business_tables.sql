/*
  KURSO SAAS - BUSINESS TABLES MIGRATION
  --------------------------------------
  Restauración de tablas de negocio adaptadas a Multi-Tenant.
  Tablas: payments, expenses, payment_notifications, reimbursements, activities.
*/

-- 1. PAGOS (Payments)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_date DATE DEFAULT CURRENT_DATE,
    concept TEXT,
    payment_method TEXT, -- 'transfer', 'cash', 'webpay'
    status TEXT DEFAULT 'verified',
    activity_id UUID, -- Opcional, si es pago de actividad
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver pagos de mi tenant" ON public.payments;
CREATE POLICY "Ver pagos de mi tenant" ON public.payments
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ) OR tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
    )
);

-- 2. GASTOS (Expenses)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    category TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver gastos de mi tenant" ON public.expenses;
CREATE POLICY "Ver gastos de mi tenant" ON public.expenses
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ) OR tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
    )
);

-- 3. ACTIVIDADES (Activities)
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL, -- Costo por alumno
    activity_date DATE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver actividades de mi tenant" ON public.activities;
CREATE POLICY "Ver actividades de mi tenant" ON public.activities
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ) OR tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
    )
);

-- 4. EXCLUSIONES DE ACTIVIDAD (Activity Exclusions)
CREATE TABLE IF NOT EXISTS public.activity_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver exclusiones de mi tenant" ON public.activity_exclusions;
CREATE POLICY "Ver exclusiones de mi tenant" ON public.activity_exclusions
FOR ALL USING (
    tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
        UNION
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
);

-- 5. NOTIFICACIONES DE PAGO (Payment Notifications)
CREATE TABLE IF NOT EXISTS public.payment_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id),
    amount NUMERIC,
    payment_date DATE,
    voucher_url TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    submitted_by UUID REFERENCES public.app_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver notificaciones de mi tenant" ON public.payment_notifications;
CREATE POLICY "Ver notificaciones de mi tenant" ON public.payment_notifications
FOR ALL USING (
    tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
        UNION
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
);

-- 6. RENDICIONES (Reimbursements & Supplier Payments)
CREATE TABLE IF NOT EXISTS public.reimbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'reimbursement', -- reimbursement, supplier_payment
    status TEXT DEFAULT 'pending',
    requester_id UUID REFERENCES public.app_users(id),
    voucher_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver rendiciones de mi tenant" ON public.reimbursements;
CREATE POLICY "Ver rendiciones de mi tenant" ON public.reimbursements
FOR ALL USING (
    tenant_id IN (
        SELECT id FROM public.tenants WHERE owner_id = auth.uid()
        UNION
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
);

-- CREDIT MANAGEMENTS (Deuda y Saldos)
CREATE TABLE IF NOT EXISTS public.credit_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL, -- 'payment_redirect', 'refund', 'credit'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credit_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver creditos de mi tenant" ON public.credit_movements;
CREATE POLICY "Ver creditos de mi tenant" ON public.credit_movements FOR ALL USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid() UNION SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
);
