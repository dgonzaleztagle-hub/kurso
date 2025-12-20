import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { School, Eye, EyeOff, KeyRound, ArrowLeft } from "lucide-react";
import logoImage from "@/assets/logo-santa-cruz.png";
import { validateRut, generateRutEmail, cleanRutForDB } from "@/lib/rutUtils";

type ViewMode = "login" | "reset-password" | "signup";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");



  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
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
        // Normalize for validation check (optional, but good for UX)
        // Actually, our validateRut handles dots/dashes
        if (validateRut(email)) {
          finalEmail = generateRutEmail(email);
          console.log("RUT detected. Converted to:", finalEmail);
        } else {
          // Not a valid RUT, and not an email. Let it fail as email or warn?
          // Let's assume it might represent a username if we supported that, but we don't.
          // We'll let SignIn try it as email, it will fail naturally.
          // Or better, warn if it looks like they tried a RUT but failed digit check.
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
          // Improve error message for RUT users
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

  // ... (Reset Password logic remains same)

  if (viewMode === "reset-password") {
    // ... (Keep existing reset password UI)
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
                <CardTitle className="text-2xl">Cambiar Contraseña</CardTitle>
              </div>
              <CardDescription>
                Ingrese su correo y una nueva contraseña
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Correo Electrónico</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="nombre.apellido@pagos.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva Contraseña</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Procesando..." : "Cambiar Contraseña"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setViewMode("login");
                  setNewPassword("");
                  setConfirmPassword("");
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
                  onClick={() => setViewMode("reset-password")}
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

      {/* Footer ... */}
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
