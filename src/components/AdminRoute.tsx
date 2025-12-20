import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export const AdminRoute = () => {
    const { appUser, loading } = useAuth();

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Check if user is logged in AND is superadmin
    if (!appUser || !appUser.is_superadmin) {
        // Redirect to dashboard if logged in but not admin, or login if not logged in
        return <Navigate to={appUser ? "/dashboard" : "/auth"} replace />;
    }

    return <Outlet />;
};
