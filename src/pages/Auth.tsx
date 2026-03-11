import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, ArrowLeft, Mail, School } from "lucide-react";
import { resolveBranding } from "@/lib/branding";
import { validateRut, generateRutEmail } from "@/lib/rutUtils";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { MercadoPagoBadge } from "@/components/subscription/MercadoPagoBadge";
import { SAAS_PRICING, formatCurrencyCLP } from "@/lib/saasBilling";

type ViewMode = "login" | "reset-password" | "signup";

export default function Auth() {
  const branding = resolveBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // States for password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getPageTitle = () => {
    switch (viewMode) {
      case 'signup': return `Registro - ${branding.appName}`;
      case 'reset-password': return `Recuperar Acceso - ${branding.appName}`;
      default: return `Ingresar - ${branding.appName}`;
    }
  };

  const getFriendlyAuthError = (rawError: any) => {
    const msg = String(rawError?.message || rawError || "").toLowerCase();

    if (
      msg.includes("load failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("err_name_not_resolved") ||
      msg.includes("networkerror")
    ) {
      return "No se pudo conectar con Supabase. Recarga la pagina y vuelve a intentar.";
    }

    if (msg.includes("invalid login credentials")) {
      return "Credenciales invalidas. Revisa correo/RUT y contraseña.";
    }

    if (msg.includes("user already registered")) {
      return "Ese correo ya esta registrado. Inicia sesion o recupera tu contraseña.";
    }

    if (msg.includes("email not confirmed")) {
      return "Tu correo aun no esta confirmado. Revisa tu bandeja de entrada.";
    }

    if (msg.includes("password should be at least")) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }

    return rawError?.message || "Error de autenticacion. Intenta nuevamente.";
  };

  useEffect(() => {
    // Detectar modo desde URL (ej: /auth?mode=signup)
    const searchParams = new URLSearchParams(location.search);
    const modeParam = searchParams.get('mode');
    if (modeParam === 'signup') setViewMode('signup');
    if (modeParam === 'reset') setViewMode('reset-password');
    if (modeParam === 'login') setViewMode('login');

    if (user) {
      const state = location.state as { from?: string } | null;
      const redirectParam = searchParams.get('redirect');
      // Prioridad: 1. Estado de navegación, 2. Param URL, 3. Dashboard por defecto
      const redirectTo = state?.from || redirectParam || "/";
      navigate(redirectTo, { replace: true });
    }
  }, [user, location.state, location.search, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    const isRutInput = viewMode === 'login' && !email.includes("@");
    const isRutLogin = isRutInput && validateRut(email);

    if (isRutInput && !isRutLogin) {
      toast.error("Ingrese RUT completo con dígito verificador (ej: 12.345.678-9).");
      return;
    }

    if (password.length < 6 && !isRutLogin) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      let finalEmail = email;

      if (isRutLogin) {
        finalEmail = generateRutEmail(email);
      }

      if (viewMode === 'signup') {
        const redirectTo = `${window.location.origin}/auth?mode=login`;
        const { data, error } = await signUp(finalEmail, password, undefined, redirectTo);
        if (error) {
          toast.error(getFriendlyAuthError(error));
        } else {
          // Supabase can return no error for already-registered emails (anti-enumeration).
          const maybeExistingUser =
            data?.user &&
            Array.isArray(data.user.identities) &&
            data.user.identities.length === 0;

          if (maybeExistingUser) {
            toast.error("Ese correo ya esta registrado. Inicia sesion o recupera tu contraseña.");
          } else if (data?.session) {
            toast.success("Cuenta creada exitosamente. !Bienvenido!");
          } else {
            toast.success("Cuenta creada. Revisa tu correo para confirmar y luego inicia sesion.");
          }
        }
      } else {
        const result = await signIn(finalEmail, password);
        const error = result.error;

        if (error) {
          toast.error(getFriendlyAuthError(error));
        } else {
          toast.success("Sesión iniciada exitosamente");
        }
      }
    } catch (error) {
      toast.error("Ocurrió un error inesperado");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Ingrese su correo electrónico");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth?mode=update",
      });
      if (error) throw error;
      toast.success("Se ha enviado un correo de recuperación", {
        description: "Revise su bandeja de entrada (y spam) para restablecer su contraseña.",
        duration: 5000,
      });
      setViewMode("login");
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast.error(getFriendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  if (viewMode === "reset-password") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
        <Helmet>
          <title>{getPageTitle()}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">

            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <KeyRound className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">Recuperar Contraseña</CardTitle>
              </div>
              <CardDescription>
                Recibirá un enlace temporal en su correo para iniciar sesión y crear una nueva clave.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    className="pl-9"
                    placeholder="nombre@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar Enlace de Recuperación"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setViewMode("login");
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al inicio de sesión
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <Helmet>
        <title>{getPageTitle()}</title>
        <meta name="description" content={`Accede a tu panel de Kurso para gestionar las finanzas de tu curso de forma segura y transparente.`} />
        <link rel="canonical" href="https://kurso.app/auth" />
      </Helmet>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">

          </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
              {branding.iconUrl ? (
                <img src={branding.iconUrl} alt={branding.appName} className="h-6 w-6 object-contain" />
              ) : (
                <School className="h-6 w-6 text-primary" />
              )}
              <CardTitle className="text-2xl">{branding.appName}</CardTitle>
            </div>
            <CardDescription>
              {viewMode === 'signup' ? 'Crea tu cuenta y activa 7 dias gratis. Luego, primer mes a $5.000 y desde el segundo $9.900.' : branding.authDescription}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "signup" && (
            <div className="mb-5 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <MercadoPagoBadge compact />
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  Renovacion manual
                </span>
              </div>
              <div className="grid gap-2 text-sm text-slate-700">
                <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                  <span>7 dias de prueba</span>
                  <strong>Gratis</strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                  <span>Primer mes</span>
                  <strong>{formatCurrencyCLP(SAAS_PRICING.introAmount)}</strong>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                  <span>Desde el segundo mes</span>
                  <strong>{formatCurrencyCLP(SAAS_PRICING.standardAmount)}</strong>
                </div>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico o RUT</Label>
              <Input
                id="email"
                type="text"
                placeholder="usuario@ejemplo.com o 12.345.678-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Procesando..." : (viewMode === 'signup' ? "Registrarse" : "Iniciar Sesión")}
            </Button>

            <div className="flex flex-col gap-2 text-center pt-2">
              {viewMode === 'login' && (
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm h-auto p-0"
                  onClick={() => {
                    setViewMode("reset-password");
                    setEmail(""); // Clear email logic if needed, or keep it if they typed it
                  }}
                >
                  ¿Olvidó su contraseña?
                </Button>
              )}

              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                {viewMode === 'login' ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto font-semibold"
                  onClick={() => setViewMode(viewMode === 'login' ? 'signup' : 'login')}
                >
                  {viewMode === 'login' ? "Regístrate gratis" : "Inicia sesión"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <footer className="mt-8 text-center">
        <p className="text-sm text-muted-foreground/80">
          {branding.authFooter}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          © {new Date().getFullYear()} {branding.legalName}
        </p>
      </footer>
    </div>
  );
}
