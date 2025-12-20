# SaaS Onboarding Kit 🚀

Este Kit contiene todo lo necesario para implementar un **Flujo de Onboarding "Premium"** en cualquier proyecto SaaS basado en React + Supabase.

Funcionalidad:
1.  **Bienvenida Visual:** Interfaz limpia y amigable.
2.  **Completitud de Perfil:** Pide Datos faltantes (Nombre, WhatsApp) *después* del registro.
3.  **Provisión de Tenant (Multitenancy):** Crea automáticamente el espacio de trabajo y asigna al usuario como dueño.

---

## 1. El Motor de Base de Datos (SQL) 🗄️

Ejecuta este SQL en tu Supabase (`SQL Editor`) para crear la función que el frontend llamará.

```sql
/**
 * RPC: create_own_tenant
 * Propósito: Permitir que un usuario cree su propio espacio y se convierta en dueño.
 * Seguridad: SECURITY DEFINER (Se salta RLS para crear el tenant inicial).
 */

CREATE OR REPLACE FUNCTION public.create_own_tenant(new_tenant_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_tenant_id uuid;
  new_slug text;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- 1. Validar Usuario
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- 2. Generar Slug (URL friendly)
  new_slug := lower(regexp_replace(new_tenant_name, '[^a-zA-Z0-9]+', '-', 'g'));
  new_slug := new_slug || '-' || floor(extract(epoch from now())); -- Timestamp para unicidad

  -- 3. Crear Tenant
  INSERT INTO public.tenants (name, slug, owner_id)
  VALUES (new_tenant_name, new_slug, current_user_id)
  RETURNING id INTO new_tenant_id;

  -- 4. Asociar Usuario como 'owner'
  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  VALUES (new_tenant_id, current_user_id, 'owner', 'active');

  RETURN json_build_object('id', new_tenant_id, 'slug', new_slug);
END;
$$;
```

---

## 2. El Componente Frontend (React/ShadCN) ⚛️

Copia este archivo en `src/pages/Onboarding.tsx`.
**Requisitos:** `lucide-react`, `shadcn/ui` (Card, Input, Button), `sonner` (Toast), y tu cliente de Supabase.

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client"; // Ajustar ruta
import { useAuth } from "@/contexts/AuthContext";         // Ajustar ruta
import { useTenant } from "@/contexts/TenantContext";     // Ajustar ruta
import { toast } from "sonner";

export default function Onboarding() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { refreshTenants } = useTenant();

    const [courseName, setCourseName] = useState("");
    const [fullName, setFullName] = useState("");
    const [whatsapp, setWhatsapp] = useState("");
    const [loading, setLoading] = useState(false);

    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Validación Básica
        if (!courseName.trim() || !fullName.trim() || !whatsapp.trim()) {
            toast.error("Por favor completa todos los campos para configurar tu cuenta");
            return;
        }

        setLoading(true);
        try {
            // 2. Actualizar Perfil de Usuario (Nombre y WhatsApp)
            if (user) {
                const { error: updateError } = await supabase
                    .from('app_users')
                    .update({ 
                        full_name: fullName, 
                        whatsapp_number: whatsapp 
                    })
                    .eq('id', user.id);

                if (updateError) {
                    console.error("Error actualizando perfil:", updateError);
                    // Manejo específico de duplicados (UX Amigable)
                    if (updateError.code === '23505') {
                         throw new Error("Este número de WhatsApp ya está registrado en otra cuenta.");
                    }
                    throw new Error("Error al guardar tu perfil. Intenta nuevamente.");
                }
            }

            // 3. Crear el Tenant (Espacio de Trabajo) vía RPC
            const { error } = await supabase
                .rpc('create_own_tenant', { new_tenant_name: courseName });

            if (error) throw error;

            toast.success("¡Espacio creado exitosamente! 🚀");

            // 4. Refrescar Contexto y Redirigir
            await refreshTenants();
            navigate("/?welcome=true"); // O tu ruta de Dashboard

        } catch (error: any) {
            console.error("Error en onboarding:", error);
            toast.error(error.message || "Error al configurar la cuenta.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
            <Card className="w-full max-w-md shadow-lg border-primary/10">
                <CardHeader className="flex flex-col items-center gap-4 text-center">
                    {/* Icono Animado */}
                    <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-2 animate-bounce-slow">
                        <Rocket className="h-10 w-10 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-bold">¡Te damos la bienvenida!</CardTitle>
                        <CardDescription>
                            Para comenzar, necesitamos unos últimos detalles <br />
                            para crear tu espacio de trabajo.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateCourse} className="space-y-6">
                        <div className="space-y-4">
                            {/* Inputs de Perfil */}
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Tu Nombre Completo</Label>
                                <Input
                                    id="fullName"
                                    placeholder="Ej. Juan Pérez"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="whatsapp">Tu WhatsApp</Label>
                                <Input
                                    id="whatsapp"
                                    type="tel"
                                    placeholder="+569..."
                                    value={whatsapp}
                                    onChange={(e) => setWhatsapp(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            
                            {/* Input de Tenant/Curso */}
                            <div className="space-y-2">
                                <Label htmlFor="courseName">Nombre de tu Proyecto/Curso</Label>
                                <Input
                                    id="courseName"
                                    placeholder="Ej. Mi Empresa S.A."
                                    value={courseName}
                                    onChange={(e) => setCourseName(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-11 text-base gap-2" disabled={loading}>
                            {loading ? (
                                <>Configurando... <Loader2 className="h-4 w-4 animate-spin" /></>
                            ) : (
                                "Crear mi Espacio Oficial"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
```

## 3. Checklist de Integración ✅

1.  **Tablas:** Asegúrate de tener tablas `public.app_users` y `public.tenants` en Supabase.
2.  **Políticas:** Recuerda "relajar" la restricción `NOT NULL` del teléfono en `app_users` si usas el registro en 2 pasos.
3.  **Rutas:** Configura tu Router para que si `user` existe pero `tenants.length === 0`, redirija a `/onboarding`.

¡Listo para desplegar! 🚀
