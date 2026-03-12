import test from "node:test";
import assert from "node:assert/strict";

import { canManageParentUsers } from "../../supabase/functions/_shared/parentUserPermissions.ts";

test("canManageParentUsers allows superadmin, owner and admin roles", () => {
  assert.equal(canManageParentUsers({ isSuperadmin: true }), true);
  assert.equal(canManageParentUsers({ ownsTenant: true }), true);
  assert.equal(canManageParentUsers({ tenantRole: "owner" }), true);
  assert.equal(canManageParentUsers({ tenantRole: "admin" }), true);
});

test("canManageParentUsers rejects non-manager tenant roles", () => {
  assert.equal(canManageParentUsers({ tenantRole: "member" }), false);
  assert.equal(canManageParentUsers({ tenantRole: "alumnos" }), false);
  assert.equal(canManageParentUsers({ tenantRole: null }), false);
});
