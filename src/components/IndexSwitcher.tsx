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
    const { availableTenants, loading: tenantLoading } = useTenant();

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
        // DEBUG TRIGGER: If user thinks they are SuperAdmin but checking fails
        if (appUser) {
            console.log("DEBUG: Redirecting to Onboarding. User:", appUser);
            // Render debug info explicitly if we HAVE a user but are redirecting
            return (
                <div className="p-8 text-white bg-slate-900 h-screen">
                    <h1 className="text-xl font-bold text-red-500 mb-4">MODO DIAGNÓSTICO (Temporal)</h1>
                    <p>El sistema te está enviando a Onboarding porque:</p>
                    <ul className="list-disc ml-6 mb-4">
                        <li>is_superadmin: {appUser.is_superadmin ? "TRUE (Deberías entrar)" : "FALSE (No eres admin)"}</li>
                        <li>Tenants encontrados: {availableTenants.length}</li>
                        <li>Email: {appUser.email}</li>
                        <li>ID: {appUser.id}</li>
                    </ul>
                    <p>Si dice FALSE, ejecuta el script SQL de nuevo. Si dice TRUE, hay un bug en el condicional.</p>
                </div>
            );
        }
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
