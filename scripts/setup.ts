import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { initialise } from "../lib/db";
import seed from "../lib/seed.json";
import { validateSite } from "../lib/sanitise";
const reset = process.argv.includes("--reset");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const production = process.env.NODE_ENV === "production";
if (
  production &&
  (!process.env.OWNER_PASSWORD ||
    !process.env.SESSION_SECRET ||
    !process.env.APP_ORIGIN)
)
  throw Error(
    "Production setup requires OWNER_PASSWORD, SESSION_SECRET and APP_ORIGIN.",
  );
if (!production) {
  let env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  for (const [key, fallback] of Object.entries({
    OWNER_PASSWORD: randomBytes(24).toString("base64url"),
    SESSION_SECRET: randomBytes(48).toString("hex"),
    APP_ORIGIN: "http://127.0.0.1:3000",
    COOKIE_SECURE: "false",
  })) {
    if (reset && key === "OWNER_PASSWORD") {
      env = env.replace(/^OWNER_PASSWORD=.*\r?\n?/m, "");
      process.env.OWNER_PASSWORD = undefined;
      delete process.env.OWNER_PASSWORD;
    }
    if (!process.env[key]) {
      process.env[key] = fallback;
      env += `${key}=${fallback}\n`;
    }
  }
  writeFileSync(".env.local", env, { mode: 0o600 });
}
if (!process.env.OWNER_PASSWORD || process.env.OWNER_PASSWORD.length < 20)
  throw Error("Owner password must have at least 20 characters.");
initialise(validateSite(seed), process.env.OWNER_PASSWORD, reset);
console.log(
  reset
    ? "Owner password reset; all sessions revoked. Existing content preserved."
    : "Schema ready. Seed inserted only if absent. Existing owner edits preserved.",
);
console.log(
  "Local credentials are in gitignored .env.local. No secret printed.",
);
