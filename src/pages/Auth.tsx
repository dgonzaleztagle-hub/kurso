import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { School, Eye, EyeOff, KeyRound, ArrowLeft, Mail } from "lucide-react";
import logoImage from "@/assets/logo-santa-cruz.png";
import { validateRut, generateRutEmail } from "@/lib/rutUtils";
import { supabase } from "@/integrations/supabase/client";

type ViewMode = "login" | "reset-password" | "signup";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // States for password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const { signIn, signUp, user, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      const redirectTo =
        state?.from || redirectParam || (userRole === "alumnos" ? "/student-dashboard" : "/");
      navigate(redirectTo, { replace: true });
    }
  }, [user, userRole, location.state, location.search, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      let finalEmail = email;

      // Check if input looks like a RUT (has numbers and maybe K) and NOT an email (@)
      if (!email.includes("@")) {
        if (validateRut(email)) {
          finalEmail = generateRutEmail(email);
          console.log("RUT detected. Converted to:", finalEmail);
        }
      }

      if (viewMode === 'signup') {
        const { error } = await signUp(finalEmail, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Cuenta creada exitosamente. !Bienvenido!");
        }
      } else {
        const { error } = await signIn(finalEmail, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Credenciales inválidas. Si usa RUT, verifique que esté correcto.");
          } else {
            toast.error(error.message);
          }
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
      toast.error("Error al enviar correo", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (viewMode === "reset-password") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <img src={logoImage} alt="Logo Colegio" className="w-24 h-24" />
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
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={logoImage} alt="Logo Colegio" className="w-24 h-24" />
          </div>
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <School className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl">Kurso SaaS</CardTitle>
            </div>
            <CardDescription>
              {viewMode === 'signup' ? 'Crea tu cuenta para comenzar' : 'Inicia sesión en su cuenta'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
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
          Plataforma de Gestión Educativa
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          © {new Date().getFullYear()} Kurso Inc.
        </p>
      </footer>
    </div>
  );
}
