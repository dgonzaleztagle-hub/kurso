export type AppRole = 'owner' | 'admin' | 'member' | 'student';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'grace_period' | 'locked';
export type PlanType = 'basic' | 'institutional';

export interface AppUser {
    id: string;
    email: string;
    full_name: string | null;
    whatsapp_number: string;
    avatar_url: string | null;
    is_superadmin: boolean;
    created_at: string;
}

export interface Organization {
    id: string;
    name: string;
    director_contact: string | null;
    plan_type: PlanType;
    valid_until: string | null;
    created_at: string;
}

export interface Tenant {
    id: string;
    organization_id: string | null;
    name: string;
    slug: string | null;
    owner_id: string;
    subscription_status: SubscriptionStatus;
    trial_ends_at: string | null;
    valid_until: string | null;
    billing_plan_code?: string | null;
    last_saas_payment_at?: string | null;
    saas_paid_cycle_count?: number;
    settings: Record<string, any>;
    status?: 'active' | 'archived' | 'pending_setup';
    fiscal_year?: number;
    previous_tenant_id?: string | null;
    next_tenant_id?: string | null;
    created_at: string;
}

export interface SaasPlan {
    code: string;
    name: string;
    description: string | null;
    amount: number;
    currency: string;
    billing_days: number;
    is_active: boolean;
    created_at: string;
}

export interface SaasPaymentLog {
    id: string;
    payment_id: string;
    tenant_id: string;
    plan_code: string | null;
    pricing_stage: string | null;
    external_reference: string | null;
    status: string;
    status_detail: string | null;
    amount: number | null;
    expected_amount: number | null;
    currency: string | null;
    payment_method: string | null;
    payer_email: string | null;
    requires_manual_review: boolean;
    raw_data: Record<string, any>;
    webhook_payload: Record<string, any> | null;
    applied_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface TenantMember {
    id: string;
    tenant_id: string;
    user_id: string;
    role: AppRole;
    status: string;
    created_at: string;
}

export interface StudentGuardian {
    id: string;
    tenant_id: string;
    student_id: string;
    guardian_id: string;
    relationship: string | null;
    is_primary: boolean;
}

export interface MeetingMinute {
    id: string;
    tenant_id: string;
    created_at: string;
    meeting_date: string;
    content: string | null;
    image_url: string | null;
    created_by: string | null;
}
