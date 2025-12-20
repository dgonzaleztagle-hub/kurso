export type AppRole = 'owner' | 'admin' | 'member' | 'student';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled';
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
    settings: Record<string, any>;
    created_at: string;
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
