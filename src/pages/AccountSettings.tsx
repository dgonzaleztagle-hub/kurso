import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { resolveBranding } from "@/lib/branding";
import { isGuardianRole } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountDeletionCard } from "@/components/AccountDeletionCard";

const AccountSettings = () => {
  const { appUser, user, userRole } = useAuth();
  const { currentTenant } = useTenant();
  const branding = resolveBranding(currentTenant?.settings, currentTenant?.name);

  if (isGuardianRole(userRole)) {
    return <Navigate to="/mobile/profile" replace />;
  }

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Mi Cuenta | {branding.appName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Cuenta</p>
        <h1 className="text-3xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Revisa tus datos de acceso, canales legales y opciones de privacidad.
        </p>
      </section>

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Nombre</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {appUser?.full_name || "Sin nombre registrado"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {user?.email || appUser?.email || "Sin email"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Curso actual</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {currentTenant?.name || "Sin curso seleccionado"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Canales utiles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/soporte">Soporte</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/privacidad">Privacidad</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/privacy-choices">Derechos ARCO</Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <AccountDeletionCard />
    </div>
  );
};

export default AccountSettings;
