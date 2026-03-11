import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tenant } from '@/types/db';
import type { Enums } from '@/integrations/supabase/types';
import { useAuth } from './AuthContext';

interface TenantContextType {
    currentTenant: Tenant | null;
    availableTenants: Tenant[];
    loading: boolean;
    switchTenant: (tenantId: string) => void;
    roleInCurrentTenant: string | null;
    refreshTenants: (preferredTenantId?: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

type TenantMemberRole = Enums<"app_role"> | null;
type TenantMembershipRow = {
    role: TenantMemberRole;
    tenant: Tenant | null;
};

export const TenantProvider = ({ children }: { children: ReactNode }) => {
    // Dependencia de appUser para saber si es superadmin
    const { user, appUser, loading: authLoading } = useAuth();
    const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
    const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [roleInCurrentTenant, setRoleInCurrentTenant] = useState<string | null>(null);

    const determineRole = useCallback(async (tenant: Tenant, userId: string) => {
        if (appUser?.is_superadmin) {
            setRoleInCurrentTenant('owner');
            return;
        }

        if (tenant.owner_id === userId) {
            setRoleInCurrentTenant('owner');
            return;
        }

        const { data, error } = await supabase
            .from('tenant_members')
            .select('role')
            .eq('tenant_id', tenant.id)
            .eq('user_id', userId)
            .single();

        if (error) {
            console.warn('Could not resolve tenant role from tenant_members, using safe fallback:', error);
        }

        setRoleInCurrentTenant(data?.role ?? null);
    }, [appUser?.is_superadmin]);

    const fetchTenants = useCallback(async (preferredTenantId?: string, attempt = 0) => {
        try {
            setLoading(true);

            if (appUser?.is_superadmin) {
                const { data: allTenants, error } = await supabase
                    .from('tenants')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                const typedTenants = (allTenants as Tenant[] | null) ?? [];
                setAvailableTenants(typedTenants);

                if (typedTenants.length > 0) {
                    const lastTenantId = localStorage.getItem('kurso_last_tenant');
                    const target =
                        typedTenants.find((tenant) => tenant.id === preferredTenantId) ||
                        typedTenants.find((tenant) => tenant.id === currentTenant?.id) ||
                        typedTenants.find((tenant) => tenant.id === lastTenantId) ||
                        typedTenants[0];
                    setCurrentTenant(target);
                    localStorage.setItem('kurso_last_tenant', target.id);
                    setRoleInCurrentTenant('owner');
                }
                setLoading(false);
                return;
            }

            const { data: memberships, error: memberError } = await supabase
                .from('tenant_members')
                .select(`
          role,
          tenant:tenants (
            id,
            name,
            subscription_status,
            trial_ends_at,
            valid_until,
            billing_plan_code,
            last_saas_payment_at,
            saas_paid_cycle_count,
            owner_id,
            settings,
            status,
            fiscal_year,
            previous_tenant_id,
            next_tenant_id,
            organization_id,
            slug,
            created_at
          )
                `)
                .eq('user_id', user?.id)
                .eq('status', 'active');
            if (memberError) {
                console.warn('Tenant memberships unavailable, falling back to owner tenants:', memberError);
            }

            const { data: ownedTenants, error: ownerError } = await supabase
                .from('tenants')
                .select('*')
                .eq('owner_id', user?.id);

            if (ownerError) throw ownerError;

            const tenantsFromMembership = memberError
                ? []
                : ((memberships as TenantMembershipRow[] | null) ?? [])
                    .map((membership) => membership.tenant)
                    .filter((tenant): tenant is Tenant => tenant !== null);
            const allTenants = [...tenantsFromMembership, ...((ownedTenants as Tenant[] | null) ?? [])];

            let uniqueTenants = Array.from(new Map(allTenants.map((tenant) => [tenant.id, tenant])).values()) as Tenant[];

            if (preferredTenantId && !uniqueTenants.some((tenant) => tenant.id === preferredTenantId)) {
                const { data: preferredTenant, error: preferredTenantError } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('id', preferredTenantId)
                    .maybeSingle();

                if (!preferredTenantError && preferredTenant) {
                    uniqueTenants = [preferredTenant as Tenant, ...uniqueTenants];
                }
            }

            setAvailableTenants(uniqueTenants);

            if (uniqueTenants.length > 0) {
                const lastTenantId = localStorage.getItem('kurso_last_tenant');
                const activeTenantId = preferredTenantId || currentTenant?.id || lastTenantId;
                let target = uniqueTenants.find((tenant) => tenant.id === activeTenantId) || uniqueTenants[0];

                if (target?.id) {
                    const { data: freshTenant, error: freshTenantError } = await supabase
                        .from('tenants')
                        .select('*')
                        .eq('id', target.id)
                        .maybeSingle();

                    if (!freshTenantError && freshTenant) {
                        target = freshTenant as Tenant;
                        uniqueTenants = uniqueTenants.map((tenant) => tenant.id === target.id ? target : tenant);
                        setAvailableTenants(uniqueTenants);
                    }
                }

                setCurrentTenant(target);
                localStorage.setItem('kurso_last_tenant', target.id);
                sessionStorage.removeItem('kurso_pending_tenant_id');
                await determineRole(target, user!.id);
            } else {
                if (preferredTenantId && attempt < 4) {
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    await fetchTenants(preferredTenantId, attempt + 1);
                    return;
                }

                setCurrentTenant(null);
                setRoleInCurrentTenant(null);
            }
        } catch (error: unknown) {
            console.error('Error fetching tenants:', error);
        } finally {
            setLoading(false);
        }
    }, [appUser?.is_superadmin, currentTenant?.id, determineRole, user]);

    useEffect(() => {
        // Wait for auth to settle, then load tenants even if app_users row is missing.
        if (user && !authLoading) {
            void fetchTenants();
        } else if (!user) {
            // If no user, reset text context and stop loading immediately
            setCurrentTenant(null);
            setAvailableTenants([]);
            setLoading(false);
        }
    }, [appUser?.is_superadmin, authLoading, fetchTenants, user]);

    const switchTenant = async (tenantId: string) => {
        const target = availableTenants.find(t => t.id === tenantId);
        if (target && user) {
            setCurrentTenant(target);
            localStorage.setItem('kurso_last_tenant', tenantId);
            await determineRole(target, user.id);
        }
    };

    // Auto-select tenant if we have one but none is selected (e.g. after create)
    useEffect(() => {
        if (!loading && availableTenants.length > 0 && !currentTenant) {
            const lastTenantId = localStorage.getItem('kurso_last_tenant');
            const target = availableTenants.find(t => t.id === lastTenantId) || availableTenants[0];
            setCurrentTenant(target);
            localStorage.setItem('kurso_last_tenant', target.id);
            if (user) {
                void determineRole(target, user.id);
            }
        }
    }, [availableTenants, currentTenant, determineRole, loading, user]);


    return (
        <TenantContext.Provider value={{
            currentTenant,
            availableTenants,
            loading,
            switchTenant,
            roleInCurrentTenant,
            refreshTenants: fetchTenants // Expose reload function
        }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};
