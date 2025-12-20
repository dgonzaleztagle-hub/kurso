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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados Legacy (Compatibilidad)
  const [userRole, setUserRole] = useState<LegacyRole | null>(null);

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
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAppUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching app user:', error);
      }

      setAppUser(data as AppUser);

      setAppUser(data as AppUser);

      // MOCK ROLE FOR NOW (Compatibilidad)
      // Si es superadmin -> master (para ver todo)
      // Si no, dejamos que layout/tenant context decidan, o ponemos 'member' como placeholder seguro
      // PERO no 'student' que oculta el sidebar.
      if (data?.is_superadmin) {
        setUserRole('master');
      } else {
        // Fix: No forzar student. Dejar null para que el sistema use el rol del tenant.
        // O mejor, usar 'admin' temporalmente si es owner, pero la verdad deberíamos matar userRole de aquí.
        // Para evitar el "white screen" rápido:
        setUserRole(null);
      }

    } catch (error) {
      console.error('Auth fetch error:', error);
    } finally {
      setLoading(false);
    }
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
      updateProfile, // Exposed
      // Legacy
      userRole,
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
