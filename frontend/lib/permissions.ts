import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

// Better Auth governs identity-level actions. FastAPI remains the policy
// enforcement point for shelters, drivers, and rides.
const statement = {
  ...defaultStatements,
} as const;

export const accessControl = createAccessControl(statement);

export const driverRole = accessControl.newRole({});
export const shelterAdminRole = accessControl.newRole({});
export const superAdminRole = accessControl.newRole({
  ...adminAc.statements,
});
