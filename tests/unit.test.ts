import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import seed from "../lib/seed.json";
import { validateSite, cleanRich } from "../lib/sanitise";
import {
  flatten,
  editById,
  duplicate,
  child,
  find,
  checklist,
  safeUrl,
} from "../lib/model";
import { siteSchema } from "../lib/schema";
import {
  initialise,
  readDraft,
  readPublished,
  writeContent,
  passwordHash,
  verifyPassword,
  signIn,
  sessionValid,
  signOut,
  requireConfig,
} from "../lib/db";
const site = validateSite(seed);
test("source specification bytes unchanged", (t) => {
  // website.txt is deliberately not published: it is the original AI prompt
  // history. When it is present it must still be byte-identical, because the
  // seed is generated from it.
  if (!existsSync("website.txt"))
    return t.skip("website.txt is kept out of the public repository");
  assert.equal(
    createHash("sha256").update(readFileSync("website.txt")).digest("hex"),
    "ddc249ca86ceaa510882d7af900880a110646eab4ee78097c6a0491878b9e11f",
  );
});
test("complete stable canonical coverage and honest evidence", () => {
  const nodes = flatten(site.root);
  assert.equal(nodes.filter((n) => n.kind === "section").length, 9);
  assert.equal(nodes.filter((n) => n.kind === "stage").length, 5);
  assert.equal(nodes.filter((n) => n.kind === "peso").length, 4);
  assert.equal(nodes.filter((n) => n.kind === "channel").length, 8);
  assert.equal(nodes.filter((n) => n.kind === "kpi").length, 23);
  assert.equal(nodes.filter((n) => n.kind === "reference").length, 9);
  assert.equal(nodes.filter((n) => n.kind === "image").length, 9);
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length);
  assert.ok(!find(site.root, "porter-product-image-2"));
  assert.ok(!find(site.root, "porter-product-image-3"));
  assert.match(
    child(find(site.root, "introduction")!, "Introduction")!.text,
    /A carrier can be practical/,
  );
  assert.ok(
    nodes
      .filter((n) => n.kind === "kpi")
      .every((n) => child(n, "Actual result")?.text === ""),
  );
  assert.ok(checklist(site).length > 30);
});
test("nested duplication and independent field/style/image edits", () => {
  const nodes = flatten(site.root);
  const reach = nodes.find(
    (n) => n.kind === "kpi" && n.label === "Monthly reach",
  )!;
  const target = child(reach, "Proposed target")!;
  let next = editById(site, target.id, (n) => {
    n.text = "+31%";
  });
  next = editById(next, "ref-base44", (n) => {
    n.text = "Temporary reference";
  });
  next = editById(next, "porter-product-image-1", (n) => {
    n.config.src = "/temporary.png";
  });
  next = editById(next, reach.id, (n) => {
    n.style.color = "#123456";
  });
  const altered = flatten(next.root).filter(
    (n) => JSON.stringify(n) !== JSON.stringify(find(site.root, n.id)),
  );
  assert.ok(altered.length > 0);
  assert.equal(
    find(next.root, "porter-hero-image")!.config.src,
    "/placeholder.svg",
  );
  assert.equal(
    find(next.root, "ref-academic")!.text,
    find(site.root, "ref-academic")!.text,
  );
  const copy = duplicate(reach);
  const oldIds = new Set(flatten(reach).map((n) => n.id));
  assert.ok(flatten(copy).every((n) => !oldIds.has(n.id)));
  child(copy, "Proposed target")!.text = "copy only";
  assert.notEqual(child(reach, "Proposed target")!.text, "copy only");
});
test("rich-text and URL sanitisation; import and survey validation", () => {
  assert.equal(
    cleanRich(
      '<script>alert(1)</script><b>safe</b><a href="javascript:alert(1)">link</a>',
    ),
    '<b>safe</b><a rel="noopener noreferrer">link</a>',
  );
  assert.ok(!safeUrl("javascript:alert(1)"));
  assert.ok(!safeUrl("//evil.example"));
  assert.ok(!safeUrl("data:image/svg+xml,x"));
  const duplicateId = structuredClone(site);
  duplicateId.root.children.push(structuredClone(duplicateId.root.children[0]));
  assert.throws(() => siteSchema.parse(duplicateId));
  const survey = flatten(site.root).find((n) => n.kind === "survey")!;
  const bad = editById(site, survey.id, (n) => {
    n.config.denominator = 2;
    n.children.find((c) => c.kind === "option")!.config.count = 3;
  });
  assert.throws(() => validateSite(bad));
  const good = editById(site, survey.id, (n) => {
    n.config.denominator = 2;
    n.children.find((c) => c.kind === "option")!.config.count = 1;
  });
  assert.doesNotThrow(() => validateSite(good));
});
test("SQLite draft isolation, atomic publication, stale conflicts, idempotent seed and authentication", () => {
  const temp = mkdtempSync(join(process.cwd(), "data", "unit-"));
  const oldPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = join(temp, "test.sqlite");
  process.env.SESSION_SECRET =
    "test-only-session-secret-with-at-least-32-characters";
  process.env.APP_ORIGIN = "http://127.0.0.1:3000";
  try {
    initialise(site, "temporary-owner-password-123456789");
    const original = readPublished();
    const draft = readDraft();
    const changed = editById(draft.content, "hero-title", (n) => {
      n.text = "Temporary unpublished title";
    });
    writeContent(changed, draft.version, false);
    assert.deepEqual(readPublished(), original);
    assert.equal(
      find(readDraft().content.root, "hero-title")!.text,
      "Temporary unpublished title",
    );
    assert.throws(() => writeContent(site, draft.version, true), /CONFLICT/);
    assert.deepEqual(readPublished(), original);
    writeContent(changed, readDraft().version, true);
    assert.equal(
      find(readPublished().root, "hero-title")!.text,
      "Temporary unpublished title",
    );
    initialise(site, "unrelated-password-123456789");
    assert.equal(
      find(readPublished().root, "hero-title")!.text,
      "Temporary unpublished title",
    );
    const hash = passwordHash("random password");
    assert.ok(verifyPassword("random password", hash));
    assert.ok(!verifyPassword("wrong password", hash));
    assert.throws(() => signIn("incorrect"), /Incorrect/);
    const token = signIn("temporary-owner-password-123456789");
    assert.ok(sessionValid(token));
    signOut(token);
    assert.ok(!sessionValid(token));
    delete process.env.SESSION_SECRET;
    assert.throws(() => requireConfig(), /absent/);
  } finally {
    if (oldPath) process.env.DATABASE_PATH = oldPath;
    else delete process.env.DATABASE_PATH;
    rmSync(temp, { recursive: true, force: true });
  }
});
