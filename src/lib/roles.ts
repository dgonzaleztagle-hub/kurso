export type CanonicalRole = "owner" | "staff" | "guardian";
export type AppRole =
  | CanonicalRole
  | "master"
  | "admin"
  | "alumnos"
  | "student"
  | "member"
  | string;

const roleRank: Record<CanonicalRole, number> = {
  guardian: 1,
  staff: 2,
  owner: 3,
};

export function normalizeRole(role?: string | null): CanonicalRole | null {
  if (!role) return null;

  switch (role) {
    case "owner":
    case "master":
      return "owner";
    case "staff":
    case "admin":
      return "staff";
    case "guardian":
    case "alumnos":
    case "student":
    case "member":
      return "guardian";
    default:
      return null;
  }
}

export function getRoleLabel(role?: string | null): string {
  switch (normalizeRole(role)) {
    case "owner":
      return "Owner";
    case "staff":
      return "Staff";
    case "guardian":
      return "Guardian";
    default:
      return role || "Sin rol";
  }
}

export function isOwnerRole(role?: string | null): boolean {
  return normalizeRole(role) === "owner";
}

export function isStaffRole(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "staff";
}

export function isGuardianRole(role?: string | null): boolean {
  return normalizeRole(role) === "guardian";
}

export function canManageStaff(role?: string | null): boolean {
  return isOwnerRole(role);
}

export function canManageGuardians(role?: string | null): boolean {
  return isStaffRole(role);
}

export function hasRoleAccess(userRole?: string | null, requiredRole?: string | null): boolean {
  const user = normalizeRole(userRole);
  const required = normalizeRole(requiredRole);
  if (!user || !required) return false;
  return roleRank[user] >= roleRank[required];
}

export function hasAnyRoleAccess(userRole?: string | null, allowedRoles?: string[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.some((role) => hasRoleAccess(userRole, role));
}
