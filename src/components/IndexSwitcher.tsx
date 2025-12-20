import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import Dashboard from "@/pages/Dashboard";
import Landing from "@/pages/Landing";
import { Layout } from "@/components/Layout";

import { Loader2 } from "lucide-react";

export const IndexSwitcher = () => {
    const { user, appUser, loading } = useAuth();
    const { toast } = useToast();

    // Debug effect removed

    if (loading) return null; // Or a nice spinner

    if (!user) {
        return <Landing />;
    }

    // SuperAdmin Priority Redirection
    if (appUser?.is_superadmin) {
        return <Navigate to="/admin" replace />;
    }

    // Safety Net: Logged in but no AppUser profile? (Ghost User from Wipeout)
    if (user && !appUser) {
        // ... (existing error handling)
    }

    // NEW USER FLOW: If no tenants found, force Onboarding to create the first course
    // But check if we are already on onboarding to avoid loop is handled by Router, but here we render components.
    // IndexSwitcher is usually invoked by "/" route.

    // Check if the user has any tenants
    const { availableTenants, loading: tenantLoading } = useTenant();

    if (loading || tenantLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    if (availableTenants.length === 0) {
        return <Navigate to="/onboarding" replace />;
    }

    return (
        <Layout>
            <Dashboard />
        </Layout>
    );

    // Si está logueado como usuario normal, mostramos el Dashboard con su Layout
    return (
        <Layout>
            <Dashboard />
        </Layout>
    );
};
