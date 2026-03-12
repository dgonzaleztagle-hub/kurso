import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { hasAnyRoleAccess, isGuardianRole, normalizeRole } from '@/lib/roles';

type AppModule =
  | 'dashboard'
  | 'students'
  | 'income'
  | 'expenses'
  | 'debt_reports'
  | 'payment_reports'
  | 'balance'
  | 'import'
  | 'movements'
  | 'activities'
  | 'activity_exclusions'
  | 'activity_payments'
  | 'monthly_fees'
  | 'payment_notifications'
  | 'reimbursements'
  | 'scheduled_activities'
  | 'student_profile'
  | 'credit_management'
  | 'credit_movements';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  requiredModule?: AppModule;
}

export const ProtectedRoute = ({ children, allowedRoles, requiredModule }: ProtectedRouteProps) => {
  const { user, userRole, loading, adminPermissions } = useAuth();
  const { roleInCurrentTenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const effectiveRole = roleInCurrentTenant || userRole;
  const normalizedRole = normalizeRole(effectiveRole);
  const isModuleAllowed = !requiredModule || normalizedRole !== 'staff' || !adminPermissions.includes(requiredModule);

  useEffect(() => {
    if (!loading && !tenantLoading) {
      if (!user) {
        navigate('/auth', {
          state: { from: location.pathname + location.search },
        });
      } else if (allowedRoles && !hasAnyRoleAccess(effectiveRole, allowedRoles)) {
        if (isGuardianRole(effectiveRole)) {
          navigate('/mobile');
        } else {
          navigate('/');
        }
      } else if (!isModuleAllowed) {
        navigate('/');
      }
    }
  }, [user, effectiveRole, loading, tenantLoading, navigate, allowedRoles, isModuleAllowed, location]);

  if (loading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
