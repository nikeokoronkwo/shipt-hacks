import { rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

export default function cleanup() {
  const directory = process.env.SHELTERCONNECT_E2E_DIRECTORY;
  if (directory && path.dirname(directory) === tmpdir() && path.basename(directory).startsWith("shelterconnect-e2e-")) {
    rmSync(directory, { recursive: true, force: true });
  }
}
