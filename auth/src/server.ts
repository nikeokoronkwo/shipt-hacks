import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth, trustedOrigins } from "./auth.js";

const app = express();
app.use(cors({ origin: trustedOrigins, credentials: true }));
app.all("/api/auth/{*path}", toNodeHandler(auth));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
const server = app.listen(Number(process.env.PORT ?? 3001), "127.0.0.1", () => {
  console.log("ShelterConnect authentication service started");
});
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
