import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppUser } from '@/types/db';

type AppModule = 'dashboard' | 'students' | 'income' | 'expenses' | 'debt_reports' | 'payment_reports' | 'balance' | 'import' | 'movements' | 'activities' | 'activity_exclusions' | 'activity_payments' | 'monthly_fees' | 'payment_notifications' | 'reimbursements' | 'scheduled_activities' | 'student_profile' | 'credit_management' | 'credit_movements';

// Importante: El rol ya no es global, sino por Tenant. Pero mantenemos userRole para compatibilidad temp con Layout
// En el futuro, Layout debe leer useTenant()
type LegacyRole = 'master' | 'admin' | 'alumnos' | 'owner' | 'member' | 'student';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, meta?: any) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<AppUser>) => Promise<{ error: any }>;

  // Legacy support props (to be deprecated later)
  userRole: LegacyRole | null; // Mapear role del tenant actual aqui
  adminPermissions: AppModule[]; // Mapear permisos aqui
  studentId: number | null;
  hasPermission: (module: AppModule) => boolean;
  firstLogin: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados Legacy (Compatibilidad)
  const [userRole, setUserRole] = useState<LegacyRole | null>(null);
  const [firstLogin, setFirstLogin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchAppUser(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchAppUser(session.user.id);
      else {
        setAppUser(null);
        setFirstLogin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAppUser = async (userId: string) => {
    try {
      // 1. Fetch App User
      const { data: appData, error: appError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (appError && appError.code !== 'PGRST116') {
        console.error('Error fetching app user:', appError);
      }
      setAppUser(appData as AppUser);

      // 2. Fetch User Roles (Global/First Login check)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role, first_login')
        .eq('user_id', userId)
        .single(); // Assuming one role entry per user for simple cases, or take first

      if (roleData) {
        // Normalize role
        const dbRole = roleData.role as LegacyRole;
        setUserRole(dbRole);
        setFirstLogin(roleData.first_login || false);
      } else {
        // Fallback if no user_roles entry
        if (appData?.is_superadmin) setUserRole('master');
        else setUserRole(null);
        setFirstLogin(false);
      }

    } catch (error) {
      console.error('Auth fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (user) await fetchAppUser(user.id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, meta?: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: meta }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAppUser(null);
    setUserRole(null);
    setFirstLogin(false);
  };

  // Legacy Permission Check
  const hasPermission = (module: AppModule) => {
    if (userRole === 'master' || userRole === 'owner') return true;
    return false; // TODO: Implement permissions from TenantContext
  };

  const updateProfile = async (updates: Partial<AppUser>) => {
    if (!user) return { error: "No user logged in" };

    try {
      const { error } = await supabase
        .from('app_users')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      setAppUser(prev => prev ? { ...prev, ...updates } : null);
      return { error: null };
    } catch (error) {
      console.error("Error updating profile:", error);
      return { error };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      appUser,
      loading,
      signIn,
      signUp,
      signOut,
      updateProfile,
      refreshUserData, // Exposed
      // Legacy
      userRole,
      firstLogin,      // Exposed
      studentId: null,
      adminPermissions: [],
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
