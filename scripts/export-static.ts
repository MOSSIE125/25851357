// Builds the reader-facing half of the site as plain files for GitHub Pages.
//
// GitHub Pages runs no server, so the owner editor, the JSON API and the
// authenticated asset route cannot go there. This script therefore takes the
// currently PUBLISHED snapshot, writes any uploaded photographs out as real
// files, hides or redirects the owner-access link, and asks Next for a static
// export of just "/" and "/report".
//
// Everything it moves or edits inside the repository is restored in a finally
// block, so an interrupted run leaves the normal server build intact.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { database, dbPath, readPublished, uploadsDir } from "../lib/db";
import { flatten, type Site } from "../lib/model";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "/25851357").replace(
  /\/$/,
  "",
);
const editorOrigin = (process.env.EDITOR_ORIGIN ?? "").replace(/\/$/, "");
const outDir = resolve("docs");
const distDir = resolve(".next-static");
const scratch = resolve(".export-tmp");
const committedSnapshot = "content/published.json";
// Route handlers and the owner page need a server, so they are moved out of the
// app directory for the duration of the build.
const serverOnly = ["app/api", "app/assets", "app/owner"];
const dynamicPages = ["app/page.tsx", "app/report/page.tsx"];

if (basePath && !basePath.startsWith("/"))
  throw Error(`NEXT_PUBLIC_BASE_PATH must start with "/", got "${basePath}"`);

const extensions: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

// Uploaded images live in SQLite plus data/uploads and are normally served by an
// authenticated route. Copy them into the export with a real file extension so a
// plain file server sends the right content type.
function exportAssets(site: Site) {
  const assetsOut = join(scratch, "assets");
  const wanted = flatten(site.root)
    .filter((n) => typeof n.config.src === "string")
    .filter((n) => n.config.src!.startsWith("/assets/"));
  if (wanted.length === 0) return 0;
  mkdirSync(assetsOut, { recursive: true });
  const db = database();
  const rename = new Map<string, string>();
  try {
    for (const node of wanted) {
      const id = node.config.src!.slice("/assets/".length);
      const row = db.prepare("SELECT mime FROM assets WHERE id=?").get(id) as
        { mime: string } | undefined;
      const source = join(uploadsDir(), id);
      if (!row || !existsSync(source)) {
        console.warn(`  ! missing upload for ${node.label} (${id}) — skipped`);
        continue;
      }
      const name = id + (extensions[row.mime] ?? "");
      cpSync(source, join(assetsOut, name));
      rename.set(node.config.src!, `/assets/${name}`);
    }
  } finally {
    db.close();
  }
  for (const node of flatten(site.root))
    if (node.config.src && rename.has(node.config.src))
      node.config.src = rename.get(node.config.src)!;
  return rename.size;
}

// Locally the database is the source of truth. On a CI runner there is no
// database, so fall back to the snapshot committed by `npm run snapshot`.
function publishedContent(): Site {
  if (existsSync(dbPath())) return readPublished();
  if (existsSync(committedSnapshot))
    return JSON.parse(readFileSync(committedSnapshot, "utf8"));
  throw Error(
    `No content to export. Run "npm run setup" locally, or commit ${committedSnapshot} with "npm run snapshot".`,
  );
}

function prepareSnapshot() {
  const site = structuredClone(publishedContent()) as Site;
  const assets = exportAssets(site);
  // "/owner" does not exist on Pages. Point the footer link at the deployed
  // editor when one is configured, otherwise hide it rather than ship a 404.
  const owner = flatten(site.root).find((n) => n.config.href === "/owner");
  if (owner) {
    if (editorOrigin) {
      owner.config.href = `${editorOrigin}/owner`;
      owner.config.target = "_blank";
    } else {
      owner.hidden = true;
    }
  }
  const path = join(scratch, "published.json");
  writeFileSync(path, JSON.stringify(site));
  return { path, assets, owner: owner ? !!editorOrigin : false };
}

// A base-path mistake produces a page that loads with no styling and no script,
// which is easy to miss until it is live. Fail the build here instead.
function verify() {
  const home = readFileSync(join(outDir, "index.html"), "utf8");
  const report = readFileSync(join(outDir, "report", "index.html"), "utf8");
  const count = (text: string, pattern: RegExp) =>
    (text.match(pattern) || []).length;
  const problems: string[] = [];
  if (count(home, /class="[^"]*academic-section/g) !== 9)
    problems.push("the public page does not contain nine sections");
  if (count(report, /class="[^"]*academic-section/g) !== 9)
    problems.push("the report does not contain nine sections");
  if (count(report, /class="kpi card"/g) !== 23)
    problems.push("the report does not contain 23 KPI cards");
  if (count(report, /class="reference"/g) !== 9)
    problems.push("the report does not contain nine references");
  if (!existsSync(join(outDir, ".nojekyll")))
    problems.push(".nojekyll is missing, so Pages would delete _next/");
  if (basePath)
    for (const [name, html] of [
      ["index.html", home],
      ["report/index.html", report],
    ] as const)
      for (const m of html.matchAll(/(?:src|href)="(\/[^"]*)"/g))
        if (!m[1].startsWith(basePath + "/") && m[1] !== basePath)
          problems.push(`${name} has an unprefixed link or asset: ${m[1]}`);
  if (problems.length)
    throw Error("Export verification failed:\n  - " + problems.join("\n  - "));
  console.log("Verified: sections, KPIs, references, .nojekyll and base path.");
}

function run() {
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  const snapshot = prepareSnapshot();
  console.log(
    `Snapshot ready: ${snapshot.assets} uploaded image(s); owner link ${snapshot.owner ? "points at " + editorOrigin : "hidden"}.`,
  );

  const originals = new Map(
    dynamicPages.map((f) => [f, readFileSync(f, "utf8")]),
  );
  const moved: string[] = [];
  try {
    for (const dir of serverOnly) {
      if (!existsSync(dir)) continue;
      renameSync(dir, join(scratch, dir.replace(/[\\/]/g, "_")));
      moved.push(dir);
    }
    for (const [file, text] of originals)
      writeFileSync(
        file,
        text.replace(
          'export const dynamic = "force-dynamic";',
          'export const dynamic = "force-static";',
        ),
      );
    // Generated route types still reference the moved handlers.
    rmSync(".next", { recursive: true, force: true });
    rmSync(distDir, { recursive: true, force: true });
    execFileSync("npx", ["next", "build"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        STATIC_EXPORT: "1",
        NEXT_PUBLIC_BASE_PATH: basePath,
        EXPORT_SNAPSHOT: snapshot.path,
      },
    });
  } finally {
    for (const [file, text] of originals) writeFileSync(file, text);
    for (const dir of moved)
      renameSync(join(scratch, dir.replace(/[\\/]/g, "_")), dir);
  }

  const built = existsSync(join("out", "index.html"))
    ? resolve("out")
    : distDir;
  if (!existsSync(join(built, "index.html")))
    throw Error(`Export produced no index.html in ${built}`);
  rmSync(outDir, { recursive: true, force: true });
  cpSync(built, outDir, { recursive: true });
  if (existsSync(join(scratch, "assets")))
    cpSync(join(scratch, "assets"), join(outDir, "assets"), {
      recursive: true,
    });
  // Without this GitHub Pages runs Jekyll, which silently drops _next/.
  writeFileSync(join(outDir, ".nojekyll"), "");
  if (process.env.PAGES_CNAME)
    writeFileSync(join(outDir, "CNAME"), process.env.PAGES_CNAME + "\n");
  rmSync(scratch, { recursive: true, force: true });
  rmSync(distDir, { recursive: true, force: true });
  rmSync("out", { recursive: true, force: true });

  verify();
  console.log(
    `\nStatic site written to docs/ (base path "${basePath || "/"}")`,
  );
  console.log("  docs/index.html      the public site");
  console.log("  docs/report/         the full academic report");
  console.log("  docs/.nojekyll       stops Pages from deleting _next/");
}

run();
