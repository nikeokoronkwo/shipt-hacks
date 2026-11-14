import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

export const ac = createAccessControl(defaultStatements);
export const roles = {
  driver: ac.newRole({}),
  shelter_admin: ac.newRole({}),
  super_admin: ac.newRole(adminAc.statements),
};
