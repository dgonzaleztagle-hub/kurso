import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { resolveBranding } from "@/lib/branding";
import { AlertCircle, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const branding = resolveBranding();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Helmet>
        <title>404 - Página no encontrada | {branding.appName}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="text-center space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
        <div className="flex justify-center">
            <div className="p-4 bg-destructive/10 rounded-full">
                <AlertCircle className="h-16 w-16 text-destructive" />
            </div>
        </div>
        
        <div className="space-y-2">
            <h1 className="text-6xl font-extrabold tracking-tighter">404</h1>
            <h2 className="text-2xl font-bold tracking-tight">Perdido en el curso?</h2>
            <p className="text-muted-foreground">
                Parece que la página que buscas no existe o ha sido movida. No te preocupes, el dinero del curso sigue seguro. 😉
            </p>
        </div>

        <div className="flex flex-col gap-2 pt-4">
            <Button asChild size="lg" className="rounded-full shadow-lg">
                <Link to="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Inicio
                </Link>
            </Button>
            <Button asChild variant="ghost">
                <a href="https://wa.me/56954031472" target="_blank" rel="noopener noreferrer">
                    ¿Necesitas Soporte Técnico?
                </a>
            </Button>
        </div>

        <footer className="pt-8 opacity-40">
            <img src={branding.iconUrl} alt={branding.appName} className="h-8 mx-auto grayscale" />
        </footer>
      </div>
    </div>
  );
};

export default NotFound;
