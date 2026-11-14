import { auth, database } from "./auth.js";

// Local operator command: never expose this operation as an HTTP endpoint.
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
try {
  await auth.api.createUser({ body: {
    email, password, name: process.env.ADMIN_NAME ?? "ShelterConnect Administrator",
    role: "super_admin",
  } });
  console.log("Super administrator created");
} finally {
  database.close();
}
