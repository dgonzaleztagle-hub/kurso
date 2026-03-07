import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tenant } from '@/types/db';
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

export const TenantProvider = ({ children }: { children: ReactNode }) => {
    // Dependencia de appUser para saber si es superadmin
    const { user, appUser, loading: authLoading } = useAuth();
    const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
    const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [roleInCurrentTenant, setRoleInCurrentTenant] = useState<string | null>(null);

    useEffect(() => {
        // Wait for auth to settle, then load tenants even if app_users row is missing.
        if (user && !authLoading) {
            fetchTenants();
        } else if (!user) {
            // If no user, reset text context and stop loading immediately
            setCurrentTenant(null);
            setAvailableTenants([]);
            setLoading(false);
        }
    }, [user, authLoading, appUser?.is_superadmin]);

    const fetchTenants = async (preferredTenantId?: string, attempt = 0) => {
        try {
            setLoading(true);

            // SUPERADMIN BYPASS: Evita errores 406 y carga todo
            if (appUser?.is_superadmin) {
                const { data: allTenants, error } = await supabase
                    .from('tenants')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setAvailableTenants(allTenants as Tenant[]);

                if (allTenants && allTenants.length > 0 && !currentTenant) {
                    const lastTenantId = localStorage.getItem('kurso_last_tenant');
                    const target =
                        allTenants.find((t: any) => t.id === preferredTenantId) ||
                        allTenants.find((t: any) => t.id === lastTenantId) ||
                        allTenants[0];
                    setCurrentTenant(target as Tenant);
                    localStorage.setItem('kurso_last_tenant', target.id);
                    setRoleInCurrentTenant('owner'); // SuperAdmin es GOD
                }
                setLoading(false);
                return;
            }

            // 1. Obtener membresías (Para usuarios normales)
            const { data: memberships, error: memberError } = await supabase
                .from('tenant_members')
                .select(`
          role,
          tenant:tenants (
            id,
            name,
            subscription_status,
            owner_id,
            status,
            fiscal_year,
            previous_tenant_id,
            next_tenant_id
          )
                `)
                .eq('user_id', user?.id)
                .eq('status', 'active');
            if (memberError) {
                console.warn('Tenant memberships unavailable, falling back to owner tenants:', memberError);
            }

            // 2. Obtener tenants donde soy dueño (si no tengo membresía explícita aún)
            const { data: ownedTenants, error: ownerError } = await supabase
                .from('tenants')
                .select('*')
                .eq('owner_id', user?.id);

            if (ownerError) throw ownerError;

            // Unificar listas
            const tenantsFromMembership = memberError ? [] : memberships?.map((m: any) => m.tenant) || [];
            const allTenants = [...tenantsFromMembership, ...(ownedTenants || [])];

            // Eliminar duplicados por ID
            let uniqueTenants = Array.from(new Map(allTenants.map((item: any) => [item.id, item])).values()) as Tenant[];

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

            // 3. Seleccionar o Actualizar tenant
            if (uniqueTenants.length > 0) {
                const lastTenantId = localStorage.getItem('kurso_last_tenant');
                const activeTenantId = preferredTenantId || currentTenant?.id || lastTenantId;
                const target = uniqueTenants.find(t => t.id === activeTenantId) || uniqueTenants[0];

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
        } catch (error) {
            console.error('Error fetching tenants:', error);
        } finally {
            setLoading(false);
        }
    };

    const determineRole = async (tenant: Tenant, userId: string) => {
        // SuperAdmin siempre es owner
        if (appUser?.is_superadmin) {
            setRoleInCurrentTenant('owner');
            return;
        }

        // Si soy el owner en la tabla tenants
        if (tenant.owner_id === userId) {
            setRoleInCurrentTenant('owner');
            return;
        }

        // Si no, buscar en members
        const { data, error } = await supabase
            .from('tenant_members')
            .select('role')
            .eq('tenant_id', tenant.id)
            .eq('user_id', userId)
            .single();

        if (error) {
            console.warn('Could not resolve tenant role from tenant_members, using safe fallback:', error);
        }

        if (data) {
            setRoleInCurrentTenant(data.role);
        } else {
            setRoleInCurrentTenant('student'); // Fallback seguro
        }
    };

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
            if (user) determineRole(target, user.id);
        }
    }, [availableTenants, loading, currentTenant, user]);


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
