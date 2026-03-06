export type AppRole = "owner" | "master" | "admin" | "alumnos" | "student" | "member" | string;

const roleRank: Record<string, number> = {
  member: 0,
  student: 1,
  alumnos: 1,
  admin: 2,
  master: 3,
  owner: 3,
};

function normalizedRole(role?: string | null): string | null {
  if (!role) return null;
  if (role === "owner") return "master";
  return role;
}

export function hasRoleAccess(userRole?: string | null, requiredRole?: string | null): boolean {
  const user = normalizedRole(userRole);
  const required = normalizedRole(requiredRole);
  if (!user || !required) return false;
  const userLevel = roleRank[user] ?? -1;
  const requiredLevel = roleRank[required] ?? -1;
  return userLevel >= requiredLevel;
}

export function hasAnyRoleAccess(userRole?: string | null, allowedRoles?: string[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.some((role) => hasRoleAccess(userRole, role));
}
