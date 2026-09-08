import seed from "../lib/seed.json";
import { readDraft, writeContent } from "../lib/db";
process.loadEnvFile(".env.local");
const current = readDraft();
writeContent(seed, current.version, true);
console.log("Build-session seed synchronised.");
