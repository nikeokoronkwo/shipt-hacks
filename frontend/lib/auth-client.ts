import { createAuthClient } from "better-auth/react";
import { adminClient, jwtClient, phoneNumberClient } from "better-auth/client/plugins";

import {
  accessControl,
  driverRole,
  shelterAdminRole,
  superAdminRole,
} from "./permissions";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
  plugins: [
    adminClient({
      ac: accessControl,
      roles: {
        driver: driverRole,
        shelter_admin: shelterAdminRole,
        super_admin: superAdminRole,
      },
    }),
    jwtClient(),
    phoneNumberClient(),
  ],
});
