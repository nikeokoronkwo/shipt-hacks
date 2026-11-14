import { createAuthClient } from "better-auth/react";
import { adminClient, jwtClient, phoneNumberClient } from "better-auth/client/plugins";

import {
  accessControl,
  driverRole,
  shelterAdminRole,
  superAdminRole,
} from "./permissions";

export const authClient = createAuthClient({
  // Same-origin by default so cookies follow the app on localhost and deployments.
  ...(process.env.NEXT_PUBLIC_BETTER_AUTH_URL ? { baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL } : {}),
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
