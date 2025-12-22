import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tenant, TenantMember } from '@/types/db';
import { useAuth } from './AuthContext';

interface TenantContextType {
    currentTenant: Tenant | null;
    availableTenants: Tenant[];
    loading: boolean;
    switchTenant: (tenantId: string) => void;
    roleInCurrentTenant: string | null;
    refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
    // Dependencia de appUser para saber si es superadmin
    const { user, appUser } = useAuth();
    const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
    const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [roleInCurrentTenant, setRoleInCurrentTenant] = useState<string | null>(null);

    useEffect(() => {
        // STRICT CHECK: Wait for appUser to be loaded
        if (user && appUser) {
            fetchTenants();
        } else if (!user) {
            // If no user, reset text context and stop loading immediately
            setCurrentTenant(null);
            setAvailableTenants([]);
            setLoading(false);
        }
    }, [user, appUser]);

    const fetchTenants = async () => {
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
                    const target = allTenants.find((t: any) => t.id === lastTenantId) || allTenants[0];
                    setCurrentTenant(target as Tenant);
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
            owner_id
          )
        `)
                .eq('user_id', user?.id)
                .eq('status', 'active');

            if (memberError) throw memberError;

            // 2. Obtener tenants donde soy dueño (si no tengo membresía explícita aún)
            const { data: ownedTenants, error: ownerError } = await supabase
                .from('tenants')
                .select('*')
                .eq('owner_id', user?.id);

            if (ownerError) throw ownerError;

            // Unificar listas
            const tenantsFromMembership = memberships?.map((m: any) => m.tenant) || [];
            const allTenants = [...tenantsFromMembership, ...(ownedTenants || [])];

            // Eliminar duplicados por ID
            const uniqueTenants = Array.from(new Map(allTenants.map((item: any) => [item.id, item])).values()) as Tenant[];

            setAvailableTenants(uniqueTenants);

            // 3. Seleccionar tenant inicial (el primero o el último visitado)
            if (uniqueTenants.length > 0 && !currentTenant) {
                // TODO: Recuperar de localStorage 'last_tenant_id'
                const lastTenantId = localStorage.getItem('kurso_last_tenant');
                const target = uniqueTenants.find(t => t.id === lastTenantId) || uniqueTenants[0];

                setCurrentTenant(target);
                await determineRole(target.id, user!.id);
            }
        } catch (error) {
            console.error('Error fetching tenants:', error);
        } finally {
            setLoading(false);
        }
    };

    const determineRole = async (tenantId: string, userId: string) => {
        // SuperAdmin siempre es owner
        if (appUser?.is_superadmin) {
            setRoleInCurrentTenant('owner');
            return;
        }

        // Si soy el owner en la tabla tenants
        const tenant = availableTenants.find(t => t.id === tenantId);
        if (tenant?.owner_id === userId) {
            setRoleInCurrentTenant('owner');
            return;
        }

        // Si no, buscar en members
        const { data } = await supabase
            .from('tenant_members')
            .select('role')
            .eq('tenant_id', tenantId)
            .eq('user_id', userId)
            .single();

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
            await determineRole(tenantId, user.id);
            // Forced reload to ensure all contexts are clean
            window.location.reload();
        }
    };

    // Auto-select tenant if we have one but none is selected (e.g. after create)
    useEffect(() => {
        if (!loading && availableTenants.length > 0 && !currentTenant) {
            const lastTenantId = localStorage.getItem('kurso_last_tenant');
            const target = availableTenants.find(t => t.id === lastTenantId) || availableTenants[0];
            setCurrentTenant(target);
            if (user) determineRole(target.id, user.id);
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
