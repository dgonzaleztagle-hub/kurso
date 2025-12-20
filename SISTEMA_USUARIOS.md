# Sistema de Usuarios - Pre Kinder B

## Roles Disponibles

El sistema cuenta con tres roles de usuario:

1. **Master** - Acceso total al sistema, puede crear otros usuarios y asignar roles
2. **Admin** - Acceso completo a todas las funcionalidades del sistema
3. **Alumnos** - Acceso limitado para apoderados (próximamente: portal de pagos)

## Estructura de Base de Datos

### Tablas Creadas

1. **user_roles** - Almacena los roles de cada usuario
   - `id` (UUID)
   - `user_id` (referencia a auth.users)
   - `role` (enum: master, admin, alumnos)
   - `created_at`

2. **user_students** - Vincula usuarios con estudiantes (para rol alumnos)
   - `id` (UUID)
   - `user_id` (referencia a auth.users)
   - `student_id` (referencia a students)
   - `created_at`

### Funciones de Seguridad

- `has_role(user_id, role)` - Función para verificar si un usuario tiene un rol específico

## Cómo Usar el Sistema

### 1. Registro de Nuevos Usuarios

1. Ir a `/auth`
2. Cambiar a la pestaña "Registrarse"
3. Ingresar correo y contraseña
4. El usuario se crea pero NO tiene acceso hasta que un Master le asigne un rol

### 2. Asignación de Roles (Solo Master)

Para asignar un rol a un usuario, el Master debe ejecutar:

```sql
-- Asignar rol Master
INSERT INTO user_roles (user_id, role) 
VALUES ('uuid-del-usuario', 'master');

-- Asignar rol Admin
INSERT INTO user_roles (user_id, role) 
VALUES ('uuid-del-usuario', 'admin');

-- Asignar rol Alumnos
INSERT INTO user_roles (user_id, role) 
VALUES ('uuid-del-usuario', 'alumnos');
```

### 3. Vincular Usuario Alumno con Estudiante

Cuando un usuario tiene rol "alumnos", debe vincularse a un estudiante:

```sql
INSERT INTO user_students (user_id, student_id)
VALUES ('uuid-del-usuario', id_del_estudiante);
```

## Crear el Primer Usuario Master

Después del primer registro, ejecutar manualmente en la base de datos:

```sql
-- 1. Obtener el ID del usuario recién creado
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- 2. Asignar rol Master
INSERT INTO user_roles (user_id, role) 
VALUES ('uuid-obtenido-en-paso-1', 'master');
```

## Permisos por Rol

### Master
- ✅ Acceso a todas las funcionalidades
- ✅ Puede asignar/eliminar roles
- ✅ Puede vincular usuarios con estudiantes

### Admin  
- ✅ Acceso a todas las funcionalidades del sistema
- ❌ No puede asignar roles

### Alumnos
- 🔄 Pendiente: Portal de pagos
- 🔄 Pendiente: Ver solo información de su estudiante vinculado

## Seguridad

- ✅ Auto-confirmación de email habilitada (para desarrollo/testing)
- ✅ Row Level Security (RLS) habilitado en todas las tablas
- ✅ Funciones de seguridad con SECURITY DEFINER
- ✅ Validación de roles en el frontend y backend
- ✅ Rutas protegidas por rol

## Próximos Pasos

1. Crear módulo "Portal de Pagos" para usuarios con rol Alumnos
2. Implementar panel de administración de usuarios para Masters
3. Agregar notificaciones por email
