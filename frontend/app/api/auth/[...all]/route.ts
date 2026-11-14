import { toNextJsHandler } from "better-auth/next-js";

import { assertAuthSecretConfigured, auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

export async function GET(...args: Parameters<typeof handlers.GET>) {
  assertAuthSecretConfigured();
  return handlers.GET(...args);
}

export async function POST(...args: Parameters<typeof handlers.POST>) {
  assertAuthSecretConfigured();
  return handlers.POST(...args);
}
