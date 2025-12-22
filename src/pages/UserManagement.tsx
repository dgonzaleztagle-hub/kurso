import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCog, Trash2, UserPlus, UserX, KeyRound, Settings, ChevronDown, Phone } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StudentCombobox } from "@/components/StudentCombobox";
import { AdminPermissionsDialog } from "@/components/AdminPermissionsDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Student {
  id: number;
  name: string;
}

type AppRole = 'master' | 'admin' | 'alumnos';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface UserStudent {
  id: string;
  user_id: string;
  student_id: number;
}

interface UserWithRole {
  id: string;
  role: AppRole;
  roleId: string;
  email: string;
  name?: string;
  userName?: string;
  position?: string;
  phone?: string;
  displayName?: string;
  studentId?: number;
  studentLinkId?: string;
}

import { useTenant } from "@/contexts/TenantContext";

export default function UserManagement() {
  const { userRole } = useAuth();
  const { roleInCurrentTenant, currentTenant } = useTenant(); // Needed currentTenant for ID
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId: string; roleId: string } | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ open: boolean; userId: string; userEmail: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);


  // Para crear admin
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminUserName, setAdminUserName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPosition, setAdminPosition] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Para crear apoderado adicional
  const [showCreateParent, setShowCreateParent] = useState(false);
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [parentDisplayName, setParentDisplayName] = useState("");
  const [parentStudentId, setParentStudentId] = useState<number | null>(null);
  const [creatingParent, setCreatingParent] = useState(false);
  const [permissionsDialog, setPermissionsDialog] = useState<{ open: boolean; userId: string; userName: string } | null>(null);
  const [alumnosOpen, setAlumnosOpen] = useState(false);
  const [editPhoneDialog, setEditPhoneDialog] = useState<{ open: boolean; userId: string; currentPhone: string; userName: string } | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [updatingPhone, setUpdatingPhone] = useState(false);

  useEffect(() => {
    if (userRole === 'master' || roleInCurrentTenant === 'owner' || roleInCurrentTenant === 'admin') {
      if (currentTenant) {
        fetchUsers();
      }
    }
  }, [userRole, roleInCurrentTenant, currentTenant]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Debe estar autenticado");
        setLoading(false);
        return;
      }

      if (!currentTenant) {
        console.error("No tenant selected");
        setLoading(false);
        return;
      }

      // SECURE CALL: Pass Tenant ID
      const { data, error } = await supabase.rpc('get_users_by_tenant' as any, {
        target_tenant_id: currentTenant.id
      });

      if (error) {
        console.error("Error invocando RPC:", error);
        throw error;
      }

      // RPC returns the JSON object directly (e.g. { "users": [...] })
      // Cast response to expected shape
      const response = data as unknown as { users: UserWithRole[] };

      if (response?.users) {
        setUsers(response.users);
      } else {
        console.log("No se recibieron usuarios en la respuesta:", data);
        setUsers([]);
      }
    } catch (error: any) {
      console.error("Error al cargar usuarios:", error);
      toast.error("Error al cargar usuarios: " + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!adminEmail || !adminPassword || !adminName) {
      toast.error("Complete todos los campos");
      return;
    }

    if (adminPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setCreatingAdmin(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Debe estar autenticado");
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
          name: adminName,
          userName: adminUserName,
          position: adminPosition,
          phone: adminPhone || null,
          tenantId: currentTenant?.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear usuario admin');
      }

      toast.success(`Admin ${adminUserName} creado exitosamente`);
      setShowCreateAdmin(false);
      setAdminEmail("");
      setAdminPassword("");
      setAdminName("");
      setAdminUserName("");
      setAdminPosition("");
      setAdminPhone("");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Error al crear admin");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteDialog) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', deleteDialog.roleId);

      if (error) throw error;

      toast.success("Rol eliminado exitosamente");
      setDeleteDialog(null);
      fetchUsers();
    } catch (error: any) {
      toast.error("Error al eliminar rol: " + error.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          // MODO PRUEBA: Sin token de autenticación
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar usuario');
      }

      toast.success("Usuario eliminado completamente del sistema");
      fetchUsers();
    } catch (error: any) {
      console.error('Error al eliminar usuario:', error);
      toast.error(error.message || "Error al eliminar usuario");
    }
  };

  const createParentUser = async () => {
    if (!parentEmail || !parentPassword || !parentStudentId) {
      toast.error("Por favor complete todos los campos requeridos");
      return;
    }

    setCreatingParent(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: parentEmail,
        password: parentPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario");

      // Insertar rol de alumnos
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'alumnos',
          first_login: true
        });

      if (roleError) {
        await handleDeleteUser(authData.user.id);
        throw roleError;
      }

      // Vincular con estudiante
      const { error: linkError } = await supabase
        .from('user_students')
        .insert({
          user_id: authData.user.id,
          student_id: parentStudentId,
          display_name: parentDisplayName || undefined
        });

      if (linkError) {
        await handleDeleteUser(authData.user.id);
        throw linkError;
      }

      toast.success("Apoderado adicional creado exitosamente");
      setShowCreateParent(false);
      setParentEmail("");
      setParentPassword("");
      setParentDisplayName("");
      setParentStudentId(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error creando apoderado:", error);
      toast.error(error.message || "Error al crear apoderado adicional");
    } finally {
      setCreatingParent(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordDialog || !newPassword) {
      toast.error("Debe ingresar una nueva contraseña");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setResettingPassword(true);

    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`, {
        method: 'POST',
        headers: {
          // MODO PRUEBA: Sin token de autenticación
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: resetPasswordDialog.userId,
          newPassword
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al resetear contraseña');
      }

      toast.success("Contraseña actualizada exitosamente");
      setResetPasswordDialog(null);
      setNewPassword("");
    } catch (error: any) {
      console.error('Error al resetear contraseña:', error);
      toast.error(error.message || "Error al resetear contraseña");
    } finally {
      setResettingPassword(false);
    }
  };



  const handleUpdatePhone = async () => {
    if (!editPhoneDialog) return;

    // Validar formato si se proporcionó un teléfono
    if (newPhone && !newPhone.startsWith('+')) {
      toast.error("El teléfono debe estar en formato internacional (ej: +56912345678)");
      return;
    }

    setUpdatingPhone(true);

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ phone: newPhone || null })
        .eq('user_id', editPhoneDialog.userId);

      if (error) throw error;

      toast.success("Teléfono actualizado exitosamente");
      setEditPhoneDialog(null);
      setNewPhone("");
      fetchUsers();
    } catch (error: any) {
      console.error('Error al actualizar teléfono:', error);
      toast.error(error.message || "Error al actualizar teléfono");
    } finally {
      setUpdatingPhone(false);
    }
  };

  const getRoleBadgeVariant = (role?: AppRole) => {
    switch (role) {
      case 'master': return 'default';
      case 'admin': return 'secondary';
      case 'alumnos': return 'outline';
      default: return 'outline';
    }
  };

  if (userRole !== 'master' && roleInCurrentTenant !== 'owner') {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Acceso denegado. Solo usuarios Master u Owner pueden acceder.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Administración de Usuarios</h1>
        <p className="text-muted-foreground">Asigna roles y gestiona permisos de usuarios</p>
      </div>

      <Card>
        <CardHeader className="py-3 md:py-6">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Crear Owner (Gestor)
              </h2>
              <p className="text-muted-foreground mb-4">
                Crea un nuevo usuario con permisos totales de gestión (Owner).
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">

              <Button
                variant={showCreateAdmin ? "outline" : "default"}
                onClick={() => setShowCreateAdmin(!showCreateAdmin)}
                size="sm"
                className="text-xs flex-1 sm:flex-initial h-8"
              >
                {showCreateAdmin ? "Cancelar" : "Nuevo Admin"}
              </Button>
              <Button
                variant={showCreateParent ? "outline" : "default"}
                onClick={() => setShowCreateParent(!showCreateParent)}
                size="sm"
                className="text-xs flex-1 sm:flex-initial h-8"
              >
                {showCreateParent ? "Cancelar" : "Nuevo Apoderado"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showCreateAdmin && (
          <CardContent className="p-3 md:p-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-user-name" className="text-xs md:text-sm">
                  Nombre de Usuario <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="admin-user-name"
                  placeholder="Ej: Nadia, Joel"
                  value={adminUserName}
                  onChange={(e) => setAdminUserName(e.target.value)}
                  disabled={creatingAdmin}
                  className="text-sm h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Este nombre se mostrará en los saludos
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-position" className="text-xs md:text-sm">
                  Cargo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="admin-position"
                  placeholder="Ej: Presidenta, Tesorera, Secretaria"
                  value={adminPosition}
                  onChange={(e) => setAdminPosition(e.target.value)}
                  disabled={creatingAdmin}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-name" className="text-xs md:text-sm">Nombre Completo</Label>
                <Input
                  id="admin-name"
                  placeholder="Ej: Nadia Tortoza"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  disabled={creatingAdmin}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs md:text-sm">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@ejemplo.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  disabled={creatingAdmin}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-xs md:text-sm">
                  Contraseña <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={creatingAdmin}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-phone" className="text-xs md:text-sm">
                  Teléfono (Opcional)
                </Label>
                <Input
                  id="admin-phone"
                  type="tel"
                  placeholder="+56912345678"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  disabled={creatingAdmin}
                  className="text-sm h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Formato internacional para notificaciones SMS
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Button
                onClick={handleCreateAdmin}
                disabled={creatingAdmin}
                className="w-full md:w-auto text-sm h-9"
                size="sm"
              >
                {creatingAdmin ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Admin"
                )}
              </Button>
            </div>
          </CardContent>
        )}
        {showCreateParent && (
          <CardContent className="p-3 md:p-6">
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="parent-student" className="text-xs md:text-sm">
                  Alumno <span className="text-destructive">*</span>
                </Label>
                <StudentCombobox
                  students={students}
                  value={parentStudentId?.toString() || ""}
                  onValueChange={(value) => setParentStudentId(parseInt(value))}
                  placeholder="Seleccionar alumno"
                />
                <p className="text-xs text-muted-foreground">
                  Selecciona el alumno para el cual se creará un apoderado adicional
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parent-email" className="text-xs md:text-sm">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="parent-email"
                  type="email"
                  placeholder="apoderado@example.com"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  disabled={creatingParent}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parent-password" className="text-xs md:text-sm">
                  Contraseña <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="parent-password"
                  type="password"
                  placeholder="******"
                  value={parentPassword}
                  onChange={(e) => setParentPassword(e.target.value)}
                  disabled={creatingParent}
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parent-display" className="text-xs md:text-sm">Nombre del Apoderado (opcional)</Label>
                <Input
                  id="parent-display"
                  placeholder="Ej: Papá de Julieta"
                  value={parentDisplayName}
                  onChange={(e) => setParentDisplayName(e.target.value)}
                  disabled={creatingParent}
                  className="text-sm h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Si no se ingresa, se usará "Apoderado de [Alumno]"
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Button
                onClick={createParentUser}
                disabled={creatingParent}
                className="w-full md:w-auto text-sm h-9"
                size="sm"
              >
                {creatingParent ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Apoderado"
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="space-y-3 md:space-y-6">
        {/* Master Users */}
        {users.filter(u => u.role === 'master').length > 0 && (
          <Card>
            <CardHeader className="py-3 md:py-6">
              <CardTitle className="text-base md:text-lg">Usuarios Master</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              <div className="space-y-2">
                {users.filter(u => u.role === 'master').map((user) => (
                  <div key={user.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 md:p-3 border rounded-lg bg-primary/5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm md:text-base">
                          {user.displayName || user.name || user.email}
                        </p>
                        <Badge variant="default" className="text-xs">Master</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetPasswordDialog({
                          open: true,
                          userId: user.id,
                          userEmail: user.email
                        })}
                        className="text-xs h-8"
                      >
                        <KeyRound className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Resetear</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteDialog({
                          open: true,
                          userId: user.id,
                          roleId: user.roleId
                        })}
                        className="text-xs h-8"
                      >
                        <Trash2 className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Eliminar</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin/Owner Users */}
        {users.filter(u => ['admin', 'owner'].includes(u.role)).length > 0 && (
          <Card>
            <CardHeader className="py-3 md:py-6">
              <CardTitle className="text-base md:text-lg">Gestores (Owners)</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              <div className="space-y-2">
                {users.filter(u => ['admin', 'owner'].includes(u.role)).map((user) => (
                  <div key={user.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 md:p-3 border rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm md:text-base">
                          {user.displayName || user.name || user.email}
                        </p>
                        <Badge variant="secondary" className="text-xs uppercase">{user.role}</Badge>
                        {user.phone && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Phone className="h-3 w-3" />
                            {user.phone}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditPhoneDialog({
                            open: true,
                            userId: user.id,
                            currentPhone: user.phone || "",
                            userName: user.userName || user.email
                          });
                          setNewPhone(user.phone || "");
                        }}
                        className="text-xs h-8"
                      >
                        <Phone className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Teléfono</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPermissionsDialog({
                          open: true,
                          userId: user.id,
                          userName: user.name || user.email
                        })}
                        className="text-xs h-8"
                      >
                        <Settings className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Permisos</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetPasswordDialog({
                          open: true,
                          userId: user.id,
                          userEmail: user.email
                        })}
                        className="text-xs h-8"
                      >
                        <KeyRound className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Resetear</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteDialog({
                          open: true,
                          userId: user.id,
                          roleId: user.roleId
                        })}
                        className="text-xs h-8"
                      >
                        <Trash2 className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Eliminar</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alumnos Users - Collapsible */}
        {users.filter(u => u.role === 'alumnos').length > 0 && (
          <Card>
            <Collapsible open={alumnosOpen} onOpenChange={setAlumnosOpen}>
              <CardHeader className="py-3 md:py-6 cursor-pointer" onClick={() => setAlumnosOpen(!alumnosOpen)}>
                <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                  <CardTitle className="text-base md:text-lg">
                    Usuarios Alumnos ({users.filter(u => u.role === 'alumnos').length})
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 transition-transform ${alumnosOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="p-3 md:p-6 pt-0">
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {users.filter(u => u.role === 'alumnos').map((user) => (
                      <div key={user.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 md:p-3 border rounded-lg bg-muted/30">
                        <div className="space-y-0.5">
                          <p className="font-medium text-sm md:text-base">{user.email}</p>
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="outline" className="text-xs w-fit">Alumno</Badge>
                            {user.studentId && user.name && (
                              <p className="text-xs text-muted-foreground">
                                {user.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResetPasswordDialog({
                              open: true,
                              userId: user.id,
                              userEmail: user.email
                            })}
                            className="text-xs h-8"
                          >
                            <KeyRound className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">Resetear</span>
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-xs h-8"
                          >
                            <Trash2 className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">Eliminar</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}
      </div>

      <AlertDialog open={deleteDialog?.open || false} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol de usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el rol asignado. El usuario perderá acceso al sistema hasta que se le asigne un nuevo rol.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetPasswordDialog?.open || false} onOpenChange={(open) => {
        if (!open) {
          setResetPasswordDialog(null);
          setNewPassword("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetear Contraseña</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa una nueva contraseña para: {resetPasswordDialog?.userEmail}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="new-password">Nueva Contraseña</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={resettingPassword}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resettingPassword}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reseteando...
                </>
              ) : (
                "Resetear Contraseña"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={editPhoneDialog?.open || false} onOpenChange={(open) => {
        if (!open) {
          setEditPhoneDialog(null);
          setNewPhone("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar Teléfono</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa el teléfono para notificaciones SMS de: {editPhoneDialog?.userName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-phone">Teléfono</Label>
            <Input
              id="edit-phone"
              type="tel"
              placeholder="+56912345678"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              disabled={updatingPhone}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Formato internacional (ej: +56912345678). Dejar vacío para eliminar.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingPhone}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdatePhone} disabled={updatingPhone}>
              {updatingPhone ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Actualizar Teléfono"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {permissionsDialog && (
        <AdminPermissionsDialog
          open={permissionsDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setPermissionsDialog(null);
              fetchUsers(); // Reload users to reflect permission changes
            }
          }}
          userId={permissionsDialog.userId}
          userName={permissionsDialog.userName}
        />
      )}
    </div>
  );
}
