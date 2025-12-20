import { ReactNode } from 'react';

// DESACTIVADO TEMPORALMENTE: Autenticación deshabilitada para desarrollo
// Para reactivar, descomentar el código original abajo

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
  allowedRoles?: ('master' | 'admin' | 'alumnos')[];
  requiredModule?: AppModule;
}

// Versión sin autenticación - permite acceso libre
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  return <>{children}</>;
};

/* CÓDIGO ORIGINAL - Descomentar para reactivar autenticación
import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

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
  allowedRoles?: ('master' | 'admin' | 'alumnos')[];
  requiredModule?: AppModule;
}

export const ProtectedRoute = ({ children, allowedRoles, requiredModule }: ProtectedRouteProps) => {
  const { user, userRole, loading, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth', {
          state: { from: location.pathname + location.search },
        });
      } else if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
        if (userRole === 'alumnos') {
          navigate('/student-dashboard');
        } else {
          navigate('/');
        }
      } else if (requiredModule && userRole === 'admin' && !hasPermission(requiredModule)) {
        navigate('/');
      }
    }
  }, [user, userRole, loading, navigate, allowedRoles, requiredModule, hasPermission, location]);

  if (loading) {
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
*/
