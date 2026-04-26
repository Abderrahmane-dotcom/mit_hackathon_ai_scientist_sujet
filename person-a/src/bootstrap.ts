// Tiny zero-dep .env loader. Imported first by entrypoints (server.ts, eval.ts).
// Reads ./.env relative to cwd. .env values OVERRIDE pre-existing shell env vars
// so that switching providers in .env actually takes effect without reopening
// the shell. Set HONOR_SHELL_ENV=1 to flip the precedence back.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.cwd(), ".env");
const honorShell = process.env.HONOR_SHELL_ENV === "1";
if (existsSync(path)) {
  const txt = readFileSync(path, "utf8");
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (honorShell && process.env[key] !== undefined) continue;
    process.env[key] = val;
  }
}
