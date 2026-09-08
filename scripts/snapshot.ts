// Writes the currently PUBLISHED content to content/published.json.
//
// The SQLite database is local and gitignored, so a CI runner building the
// GitHub Pages site cannot see your edits. This file is the bridge: publish in
// the editor, run `npm run snapshot`, commit the result, and the deployed site
// matches what you published. It is plain JSON, so a diff shows exactly which
// wording changed.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { readPublished } from "../lib/db";
import { flatten } from "../lib/model";

export const snapshotPath = "content/published.json";
const site = readPublished();
mkdirSync(dirname(snapshotPath), { recursive: true });
writeFileSync(snapshotPath, JSON.stringify(site, null, 2) + "\n");
console.log(
  `Wrote ${snapshotPath} with ${flatten(site.root).length} content records.`,
);
console.log("Commit it so the published site matches your latest Publish.");
