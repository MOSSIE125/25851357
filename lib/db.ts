import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { type Site } from "./model";
import { validateSite } from "./sanitise";
export const dbPath = () =>
  resolve(
    /* turbopackIgnore: true */ process.env.DATABASE_PATH || "data/site.sqlite",
  );
// Uploaded files live beside the database so that pointing DATABASE_PATH at a
// mounted volume keeps the rows and the image bytes together.
export const uploadsDir = () => join(dirname(dbPath()), "uploads");
export function database(writable = false) {
  if (!existsSync(/* turbopackIgnore: true */ dbPath()))
    throw Error("Application is not initialised. Run npm run setup.");
  const db = new DatabaseSync(dbPath(), { readOnly: !writable });
  db.exec("PRAGMA busy_timeout=5000");
  return db;
}
export function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const candidate = passwordHash(password, salt).split(":")[1];
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(candidate, "hex"),
  );
}
export function initialise(seed: Site, password: string, reset = false) {
  mkdirSync(dirname(dbPath()), { recursive: true });
  const db = new DatabaseSync(dbPath());
  db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY CHECK(id=1), password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS site(id INTEGER PRIMARY KEY CHECK(id=1), draft TEXT NOT NULL, version INTEGER NOT NULL, published_id INTEGER NOT NULL REFERENCES snapshots(id));
CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY, mime TEXT NOT NULL, filename TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts(id TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);`);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT OR IGNORE INTO migrations VALUES(1,?)").run(
      new Date().toISOString(),
    );
    db.prepare("INSERT OR IGNORE INTO owner VALUES(1,?)").run(
      passwordHash(password),
    );
    if (reset) {
      db.prepare("UPDATE owner SET password_hash=? WHERE id=1").run(
        passwordHash(password),
      );
      db.exec("DELETE FROM sessions");
    }
    if (!db.prepare("SELECT id FROM site WHERE id=1").get()) {
      const json = JSON.stringify(validateSite(seed));
      const result = db
        .prepare("INSERT INTO snapshots(content,created_at) VALUES(?,?)")
        .run(json, new Date().toISOString());
      db.prepare("INSERT INTO site VALUES(1,?,1,?)").run(
        json,
        result.lastInsertRowid,
      );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.close();
  }
}
export function readPublished(): Site {
  // The static export renders from a snapshot file instead of the database, so
  // the Pages build needs no SQLite and no uploads directory of its own.
  const snapshot = process.env.EXPORT_SNAPSHOT;
  if (snapshot) return JSON.parse(readFileSync(snapshot, "utf8"));
  const db = database();
  try {
    const row = db
      .prepare(
        "SELECT content FROM snapshots JOIN site ON published_id=snapshots.id WHERE site.id=1",
      )
      .get() as { content: string };
    return JSON.parse(row.content);
  } finally {
    db.close();
  }
}
export function readDraft() {
  const db = database();
  try {
    const row = db
      .prepare("SELECT draft,version FROM site WHERE id=1")
      .get() as { draft: string; version: number };
    return { content: JSON.parse(row.draft) as Site, version: row.version };
  } finally {
    db.close();
  }
}
export function writeContent(
  input: unknown,
  version: number,
  publish: boolean,
) {
  const content = validateSite(input);
  const db = database(true);
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT version FROM site WHERE id=1").get() as {
      version: number;
    };
    if (row.version !== version)
      throw Error(
        "CONFLICT: A newer draft exists. Export your work, then reload the latest draft.",
      );
    const json = JSON.stringify(content);
    db.prepare("UPDATE site SET draft=?,version=version+1 WHERE id=1").run(
      json,
    );
    if (publish) {
      const result = db
        .prepare("INSERT INTO snapshots(content,created_at) VALUES(?,?)")
        .run(json, new Date().toISOString());
      db.prepare("UPDATE site SET published_id=? WHERE id=1").run(
        result.lastInsertRowid,
      );
    }
    db.exec("COMMIT");
    return { version: version + 1, content };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.close();
  }
}
export function requireConfig() {
  if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32 ||
    !process.env.APP_ORIGIN
  )
    throw Error("Required session configuration is absent.");
  const origin = new URL(process.env.APP_ORIGIN);
  if (
    origin.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(origin.hostname)
  )
    throw Error("Non-local deployments require HTTPS.");
  if (origin.protocol === "https:" && process.env.COOKIE_SECURE !== "true")
    throw Error("HTTPS deployments require secure cookies.");
}
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function sessionValid(token: string | undefined) {
  requireConfig();
  if (!token) return false;
  const db = database();
  try {
    return !!db
      .prepare(
        "SELECT token_hash FROM sessions WHERE token_hash=? AND expires>?",
      )
      .get(digest(token), Date.now());
  } finally {
    db.close();
  }
}
export function csrf(token: string) {
  requireConfig();
  return createHmac("sha256", process.env.SESSION_SECRET!)
    .update(token)
    .digest("hex");
}
export function signIn(password: string) {
  requireConfig();
  const db = database(true);
  try {
    const now = Date.now();
    const attempt = db
      .prepare("SELECT count,reset_at FROM login_attempts WHERE id=?")
      .get("owner") as { count: number; reset_at: number } | undefined;
    if (attempt && attempt.reset_at > now && attempt.count >= 10)
      throw Error("Too many sign-in attempts. Try again in 15 minutes.");
    const owner = db
      .prepare("SELECT password_hash FROM owner WHERE id=1")
      .get() as { password_hash: string };
    if (!verifyPassword(password, owner.password_hash)) {
      db.prepare(
        "INSERT INTO login_attempts VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET count=?,reset_at=?",
      ).run(
        "owner",
        1,
        now + 900000,
        attempt && attempt.reset_at > now ? attempt.count + 1 : 1,
        attempt && attempt.reset_at > now ? attempt.reset_at : now + 900000,
      );
      throw Error("Incorrect owner password.");
    }
    db.exec("DELETE FROM login_attempts");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(now);
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?)").run(
      digest(token),
      now + 8 * 60 * 60 * 1000,
    );
    return token;
  } finally {
    db.close();
  }
}
export function signOut(token: string) {
  const db = database(true);
  try {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(token));
  } finally {
    db.close();
  }
}
