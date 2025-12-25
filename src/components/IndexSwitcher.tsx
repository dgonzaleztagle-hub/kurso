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
    const { availableTenants, loading: tenantLoading, roleInCurrentTenant } = useTenant();

    if (loading || tenantLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    if (!user) {
        return <Landing />;
    }

    // SuperAdmin Priority Redirection
    if (appUser?.is_superadmin) {
        return <Navigate to="/admin" replace />;
    }

    // NEW USER FLOW: If no tenants found, force Onboarding to create the first course
    if (availableTenants.length === 0) {
        // ... (DEBUG LOGIC OMITTED FOR BREVITY, RESTORED BELOW IF NEEDED OR KEEP EXISTING)
        // For simplicity reusing the existing block structure is risky with replace, 
        // better to just insert the redirect logic BEFORE the default return.

        return <Navigate to="/onboarding" replace />;
    }

    // ROLE REDIRECTION: Students/Parents go to Mobile View
    if (roleInCurrentTenant === 'student' || roleInCurrentTenant === 'alumnos') {
        return <Navigate to="/mobile" replace />;
    }

    // Default (Admins/Owners) -> Desktop Dashboard
    return (
        <Layout>
            <Dashboard />
        </Layout>
    );
};
