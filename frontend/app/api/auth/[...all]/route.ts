import { toNextJsHandler } from "better-auth/next-js";

import { assertAuthConfiguration, auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

export async function GET(...args: Parameters<typeof handlers.GET>) {
  assertAuthConfiguration();
  return handlers.GET(...args);
}

export async function POST(...args: Parameters<typeof handlers.POST>) {
  assertAuthConfiguration();
  return handlers.POST(...args);
}
