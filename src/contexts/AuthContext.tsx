/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppUser } from '@/types/db';

type AppModule = 'dashboard' | 'students' | 'income' | 'expenses' | 'debt_reports' | 'payment_reports' | 'balance' | 'import' | 'movements' | 'activities' | 'activity_exclusions' | 'activity_payments' | 'monthly_fees' | 'payment_notifications' | 'reimbursements' | 'scheduled_activities' | 'student_profile' | 'credit_management' | 'credit_movements';

// Importante: El rol ya no es global, sino por Tenant. Pero mantenemos userRole para compatibilidad temp con Layout
// En el futuro, Layout debe leer useTenant()
type LegacyRole = 'master' | 'admin' | 'alumnos' | 'owner' | 'member' | 'student';
type AuthErrorLike = AuthError | Error;
type SignInResult = { error: AuthErrorLike | null };
type SignUpResult = {
  data: {
    user: User | null;
    session: Session | null;
  } | null;
  error: AuthErrorLike | null;
};
type UpdateProfileResult = { error: AuthErrorLike | string | null };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, meta?: Record<string, unknown>, redirectTo?: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<AppUser>) => Promise<UpdateProfileResult>;

  // Legacy support props (to be deprecated later)
  userRole: LegacyRole | null; // Mapear role del tenant actual aqui
  adminPermissions: AppModule[]; // Mapear permisos aqui
  studentId: number | null;
  displayName: string | null;
  hasPermission: (module: AppModule) => boolean;
  firstLogin: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeAuthError = (error: unknown): AuthErrorLike => {
  if (error instanceof AuthError || error instanceof Error) {
    return error;
  }

  return new Error(String(error));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminPermissions, setAdminPermissions] = useState<AppModule[]>([]);

  // Estados Legacy (Compatibilidad)
  const [userRole, setUserRole] = useState<LegacyRole | null>(null);
  const [firstLogin, setFirstLogin] = useState(false);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchAppUser(session.user.id);
      }
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchAppUser(session.user.id);
      }
      else {
        setAppUser(null);
        setFirstLogin(false);
        setStudentId(null);
        setDisplayName(null);
        setAdminPermissions([]);
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
      setAppUser((appData as AppUser | null) ?? null);

      const { data: studentLink, error: studentLinkError } = await supabase
        .from('user_students')
        .select('student_id, display_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (studentLinkError && studentLinkError.code !== 'PGRST116') {
        console.error('Error fetching student link:', studentLinkError);
      }

      setStudentId(studentLink?.student_id ?? null);
      setDisplayName(studentLink?.display_name ?? null);

      // 2. Fetch User Roles (Global/First Login check)
      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('role, first_login')
        .eq('user_id', userId)
        .limit(1);

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error fetching user role:', roleError);
      }

      const roleData = roleRows?.[0] ?? null;

      if (roleData) {
        // Normalize role
        const dbRole = roleData.role as LegacyRole;
        setUserRole(dbRole);
        setFirstLogin(roleData.first_login || false);

        if (dbRole === 'admin') {
          const { data: permissionRows, error: permissionError } = await supabase
            .from('admin_permissions')
            .select('module')
            .eq('user_id', userId);

          if (permissionError) {
            console.error('Error fetching admin permissions:', permissionError);
            setAdminPermissions([]);
          } else {
            const deniedModules = (permissionRows ?? [])
              .map((row) => row.module)
              .filter((module): module is AppModule => typeof module === 'string');
            setAdminPermissions(deniedModules);
          }
        } else {
          setAdminPermissions([]);
        }
      } else {
        // Fallback if no user_roles entry
        if (appData?.is_superadmin) setUserRole('master');
        else setUserRole(null);
        setFirstLogin(false);
        setAdminPermissions([]);
      }

    } catch (error: unknown) {
      console.error('Auth fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchAppUser(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error: unknown) {
      return { error: normalizeAuthError(error) };
    }
  };

  const signUp = async (email: string, password: string, meta?: Record<string, unknown>, redirectTo?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: meta,
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {})
        }
      });
      return {
        data: {
          user: data.user,
          session: data.session,
        },
        error,
      };
    } catch (error: unknown) {
      return { data: null, error: normalizeAuthError(error) };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAppUser(null);
    setUserRole(null);
    setFirstLogin(false);
    setStudentId(null);
    setDisplayName(null);
    setAdminPermissions([]);
  };

  // Legacy Permission Check
  const hasPermission = (module: AppModule) => {
    if (userRole === 'master' || userRole === 'owner') return true;
    if (userRole === 'admin') return !adminPermissions.includes(module);
    return false;
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
    } catch (error: unknown) {
      console.error("Error updating profile:", error);
      return { error: normalizeAuthError(error) };
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
      studentId,
      displayName,
      adminPermissions,
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
