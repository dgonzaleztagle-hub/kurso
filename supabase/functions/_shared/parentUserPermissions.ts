type PermissionInputs = {
  isSuperadmin?: boolean | null;
  ownsTenant?: boolean | null;
  tenantRole?: string | null;
};

const MANAGE_PARENT_ROLES = new Set(["owner", "staff", "master", "admin"]);

export function canManageParentUsers({
  isSuperadmin,
  ownsTenant,
  tenantRole,
}: PermissionInputs): boolean {
  if (isSuperadmin || ownsTenant) {
    return true;
  }

  return tenantRole ? MANAGE_PARENT_ROLES.has(tenantRole) : false;
}
