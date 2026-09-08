import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { flatten, find, child, type Site } from "../lib/model";
import { origin } from "../playwright.config";
async function signIn(page: Page) {
  await page.goto("/owner");
  await page
    .getByLabel("Owner password", { exact: true })
    .fill(process.env.OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit website" }),
  ).toBeVisible();
}
async function select(page: Page, id: string) {
  await page.getByLabel("Find any content").fill(id);
  await page.locator(`[data-tree-id="${id}"]`).click();
}
test("public interactions, complete report, print preparation and keyboard evidence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".academic-section")).toHaveCount(9);
  await expect(page.locator(".hero img")).toHaveCount(1);
  await expect(page.locator("#porter-product-image-1 img")).toHaveCount(1);
  await expect(
    page.locator("#porter-product-image-2,#porter-product-image-3"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Weekend and travel", exact: true })
    .click();
  await expect(page.locator(".occasion-badge")).toContainText(
    "Weekend and travel",
  );
  await expect(page.locator(".occasion-example")).toContainText(
    "carrying comfort",
  );
  await page.getByRole("button", { name: "Laptop", exact: true }).click();
  await expect(
    page.locator(".feedback").filter({ hasText: "Employed professional" }),
  ).toBeVisible();
  await page
    .locator(".digital-day")
    .getByRole("button", { name: "17:45", exact: true })
    .click();
  await expect(page.locator(".digital-day")).toContainText(
    "Searches for the product",
  );
  for (const stage of [
    "Awareness",
    "Consideration",
    "Purchase",
    "Retention",
    "Advocacy",
  ]) {
    await page
      .locator(".journey-overview")
      .getByRole("link", { name: stage, exact: false })
      .click();
    await expect(
      page.locator(`#stage-${stage.toLowerCase()}`),
    ).toBeInViewport();
  }
  await expect(page.locator(".completion h2")).toHaveText(
    "You Have Completed Mia’s Digital Journey",
  );
  await expect(page.locator(".completion")).toContainText("5 of 5");
  await page
    .getByRole("button", { name: "visits profile", exact: true })
    .click();
  await expect(page.locator("#stage-awareness .feedback")).toContainText(
    "clear profile",
  );
  await page.getByRole("button", { name: "Not yet", exact: true }).click();
  await expect(page.locator("#stage-consideration")).toContainText(
    "recommended information categories",
  );
  await page
    .getByRole("button", { name: "Explain the simulation", exact: true })
    .click();
  await expect(page.locator("#stage-consideration")).toContainText(
    "No purchase",
  );
  await page.getByRole("button", { name: "Paid", exact: true }).click();
  await expect(page.locator(".peso-card.selected h3")).toHaveText("Paid");
  await page.getByRole("button", { name: "Expand all", exact: true }).click();
  await expect(page.locator("details.channel[open]")).toHaveCount(8);
  await page.getByRole("button", { name: "Collapse all", exact: true }).click();
  await expect(page.locator("details.channel[open]")).toHaveCount(0);
  const persona = page.locator("#persona details.disclosure");
  await expect(persona.locator("summary")).toHaveText("View complete persona");
  const personaField = page.locator("#persona").getByText("Mia Daniels, 35.");
  await expect(personaField).toBeHidden();
  await persona.locator("summary").click();
  await expect(personaField).toBeVisible();
  const chips = page.locator(".reference-filter button");
  await expect(page.locator("#references .reference")).toHaveCount(9);
  await chips.filter({ hasText: "AI tools" }).click();
  await expect(page.locator("#references .reference")).toHaveCount(2);
  await chips.filter({ hasText: "primary research" }).click();
  await expect(page.locator("#references .reference")).toHaveCount(1);
  await chips.filter({ hasText: "All sources" }).click();
  await expect(page.locator("#references .reference")).toHaveCount(9);
  const evidence = page.locator("#introduction details.evidence").first();
  await evidence.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(evidence).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(evidence).not.toHaveAttribute("open", "");
  await expect(evidence.locator("summary")).toBeFocused();
  await page.goto("/report");
  await expect(page.locator(".academic-section")).toHaveCount(9);
  await expect(page.locator(".stage")).toHaveCount(5);
  await expect(page.locator(".kpi")).toHaveCount(23);
  await expect(page.locator(".reference")).toHaveCount(9);
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printCalled = "yes";
    };
  });
  await page.getByRole("button", { name: "Print / Save as PDF" }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-print-called",
    "yes",
  );
  await expect(page.locator(".report-cover ol a")).toHaveCount(9);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".site-header")).toBeHidden();
  await page.setViewportSize({ width: 794, height: 1123 });
  const print = await page.evaluate(() => {
    let smallest = 99;
    document.querySelectorAll("*").forEach((e) => {
      const el = e as HTMLElement;
      if (el.offsetParent === null) return;
      const own = [...el.childNodes]
        .filter((c) => c.nodeType === 3)
        .map((c) => c.textContent!.trim())
        .join("")
        .trim();
      if (own.length < 3) return;
      smallest = Math.min(smallest, parseFloat(getComputedStyle(el).fontSize));
    });
    return {
      smallest,
      closedDetails: [...document.querySelectorAll("details")].filter(
        (d) => !d.open,
      ).length,
      clippedTables: [...document.querySelectorAll("table")].filter(
        (t) => t.scrollWidth > t.clientWidth + 2,
      ).length,
      chrome: [...document.querySelectorAll("button,nav,.skip-link")].filter(
        (e) => (e as HTMLElement).offsetParent !== null,
      ).length,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(print.smallest).toBeGreaterThanOrEqual(12);
  expect(print.closedDetails).toBe(0);
  expect(print.clippedTables).toBe(0);
  expect(print.chrome).toBe(0);
  expect(print.overflow).toBe(false);
  await page.pdf({
    path: "test-results/academic-report.pdf",
    format: "A4",
    printBackground: true,
  });
});
test("responsive layouts and axe accessibility at four widths in both themes", async ({
  page,
}) => {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      await page.evaluate(
        (t) => localStorage.setItem("porter-theme", t),
        theme,
      );
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/public-${theme}-${width}.png`,
      });
    }
  }
  // Nothing on a small screen may be under the WCAG 2.2 AA 24px target size,
  // and body copy stays at least 16px.
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/");
  const mobile = await page.evaluate(() => {
    const tight: string[] = [];
    document.querySelectorAll("a,button,summary,input,select").forEach((e) => {
      const el = e as HTMLElement;
      if (el.offsetParent === null) return;
      const r = el.getBoundingClientRect();
      if (r.height < 24 || r.width < 24)
        tight.push(
          `${el.tagName}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
    });
    return { tight, body: getComputedStyle(document.body).fontSize };
  });
  expect(mobile.tight).toEqual([]);
  expect(parseFloat(mobile.body)).toBeGreaterThanOrEqual(16);
  await signIn(page);
  for (const theme of ["light", "dark"] as const) {
    // Already signed in: reload rather than re-running the sign-in form.
    await page.evaluate((t) => localStorage.setItem("porter-theme", t), theme);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Edit website" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/owner-${theme}-${width}.png`,
      });
    }
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.slice(0, 3).map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
});
test("theme choice follows the system, can be switched, and survives a reload", async ({
  browser,
}) => {
  const dark = await browser.newContext({ colorScheme: "dark" });
  const darkPage = await dark.newPage();
  await darkPage.goto("/");
  // No stored choice: follow the operating system.
  await expect(darkPage.locator("html")).toHaveAttribute("data-theme", "dark");
  await dark.close();

  const light = await browser.newContext({ colorScheme: "light" });
  const page = await light.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const surface = () =>
    page.evaluate(() =>
      getComputedStyle(document.querySelector(".site")!).getPropertyValue(
        "--surface",
      ),
    );
  const lightSurface = await surface();
  await page.getByRole("button", { name: "Dark", exact: false }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkSurface = await surface();
  expect(darkSurface.trim()).not.toBe(lightSurface.trim());
  // The palette comes from the owner-editable theme, not a hardcoded value.
  expect(darkSurface.trim().toLowerCase()).toBe("#17130f");
  expect(await page.evaluate(() => localStorage.getItem("porter-theme"))).toBe(
    "dark",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Light", exact: false }),
  ).toBeVisible();
  // Paper is white whatever the reader chose on screen.
  await page.emulateMedia({ media: "print" });
  const printed = await page.evaluate(() => {
    const site = getComputedStyle(document.querySelector(".site")!);
    return {
      surface: site.getPropertyValue("--surface"),
      ink: site.getPropertyValue("--ink"),
    };
  });
  expect(printed.surface.trim()).toBe("#fff");
  expect(printed.ink.trim()).toBe("#201b17");
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Light", exact: false }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await light.close();
});
test("back to top appears after scrolling, returns to the top and moves focus", async ({
  page,
}) => {
  await page.goto("/");
  const button = page.locator(".scroll-top");
  await expect(button).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 2500));
  await expect(button).toBeVisible();
  await button.click();
  await expect
    .poll(async () => page.evaluate(() => Math.round(window.scrollY)))
    .toBe(0);
  await expect(page.locator("main#main-content")).toBeFocused();
  await expect(button).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 2500));
  await expect(button).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(button).toBeHidden();
});
test("owner manual edits, independence, uploads, JSON, conflicts and publication isolation", async ({
  page,
  browser,
  request,
}) => {
  const denied = await request.post("/api/publish", {
    headers: { Origin: origin },
    data: {},
  });
  expect(denied.status()).toBe(401);
  expect((await request.get("/api/draft")).status()).toBe(401);
  await signIn(page);
  const notice = page.locator(".editor-notices [role=status]");
  const problem = page.locator(".editor-notices [role=alert]");
  const initial = await (await page.request.get("/api/draft")).json();
  const heroPoint = await page.evaluate(() => {
    const hero = document.querySelector(".visual-preview .hero")!;
    const content = hero.querySelector(".hero-content")!;
    const h = hero.getBoundingClientRect();
    const c = content.getBoundingClientRect();
    const x = (c.right + h.right) / 2;
    const y = (h.top + h.bottom) / 2;
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    return {
      x,
      y,
      id: hit?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null,
    };
  });
  expect(heroPoint.id).toBe("porter-hero-image");
  await page.mouse.click(heroPoint.x, heroPoint.y);
  await expect(page.locator(".inspector code")).toHaveText("porter-hero-image");

  const original = initial.content as Site;
  const all = flatten(original.root);
  const refs = all.filter((n) => n.kind === "reference");
  const reach = all.find(
    (n) => n.kind === "kpi" && n.label === "Monthly reach",
  )!;
  const representative = [
    find(original.root, "hero-title")!,
    child(find(original.root, "hero")!, "Hero subtitle")!,
    original.root.children.find((n) => n.label === "Navigation")!.children[0],
    child(find(original.root, "introduction")!, "Introduction")!,
    all.find((n) => n.kind === "list")!.children[0],
    all.find((n) => n.kind === "cell")!,
    all.find((n) => n.kind === "quote")!,
    all.find((n) => n.kind === "stage")!.children[0],
    all.find((n) => n.kind === "option")!,
    all.find((n) => n.kind === "option")!.children[0],
    all.find((n) => n.kind === "evidence")!.children[0],
    all.find((n) => n.kind === "citation")!,
    refs[1],
    child(reach, "Proposed target")!,
    original.root.children.find((n) => n.kind === "footer")!,
    all
      .find((n) => n.kind === "survey")!
      .children.find((n) => n.kind === "option")!,
  ];
  try {
    for (const n of representative) {
      await select(page, n.id);
      await page
        .getByLabel("Text / rich text", { exact: true })
        .fill(`Temporary ${n.id}`);
      await expect(
        page.getByText("Unsaved changes", { exact: false }).first(),
      ).toBeVisible();
    }
    await select(page, "porter-product-image-1");
    await page
      .getByLabel("Alternative text", { exact: true })
      .fill("Temporary collage alternative");
    await page
      .getByLabel("Caption", { exact: true })
      .fill("Temporary collage caption");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9xkAAAAASUVORK5CYII=",
      "base64",
    );
    await page
      .locator(".inspector input[type=file]")
      .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
    await expect(notice).toContainText("Image uploaded");
    const src = await page
      .getByLabel("Image URL", { exact: true })
      .inputValue();
    expect(src).toContain("/assets/");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(notice).toContainText("Draft saved");
    const after = await (await page.request.get("/api/draft")).json();
    expect(find(after.content.root, "porter-hero-image")!.config.src).toBe(
      "/placeholder.svg",
    );
    expect(find(after.content.root, "mia-persona-image")!.config.src).toBe(
      "/placeholder.svg",
    );
    expect(find(after.content.root, refs[0].id)).toEqual(refs[0]);
    for (const k of all.filter((n) => n.kind === "kpi" && n.id !== reach.id))
      expect(find(after.content.root, k.id)).toEqual(k);
    expect((await request.get(src)).status()).toBe(404);
    const publicBefore = await (await request.get("/api/published")).json();
    expect(publicBefore.content).toEqual(original);
    await select(page, "porter-hero-image");
    await page
      .getByLabel("Image URL", { exact: true })
      .fill("/placeholder.svg");
    await page
      .getByLabel("Alternative text", { exact: true })
      .fill("Temporary hero only");
    await select(page, reach.id);
    await page.getByText("Typography and layout", { exact: true }).click();
    await page.getByLabel("color hex", { exact: true }).fill("#123456");
    await page
      .getByLabel("backgroundColor hex", { exact: true })
      .fill("#ddebf1");
    await page
      .getByLabel("Font family", { exact: true })
      .selectOption("Verdana, sans-serif");
    await page.getByLabel("Padding (px)", { exact: true }).fill("32");
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await page
      .getByRole("button", { name: "Proposed target →", exact: true })
      .click();
    await page
      .getByLabel("Text / rich text", { exact: true })
      .fill("Nested duplicate only");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(notice).toContainText("Draft saved");
    const draft = await (await page.request.get("/api/draft")).json();
    expect(
      child(find(draft.content.root, reach.id)!, "Proposed target")!.text,
    ).not.toBe("Nested duplicate only");
    const bad = await page.request.post("/api/draft", {
      headers: { Origin: "https://wrong.example", "x-csrf-token": draft.csrf },
      data: { content: original, version: draft.version },
    });
    expect(bad.status()).toBe(403);
    const missingCsrf = await page.request.post("/api/draft", {
      headers: { Origin: origin },
      data: { content: original, version: draft.version },
    });
    expect(missingCsrf.status()).toBe(403);
    const stale = await page.request.post("/api/draft", {
      headers: { Origin: origin, "x-csrf-token": draft.csrf },
      data: { content: original, version: initial.version },
    });
    expect(stale.status()).toBe(409);
    await page.route("**/api/draft", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Simulated write failure" }),
          })
        : route.continue(),
    );
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(problem).toContainText("Simulated write failure");
    await expect(
      page.getByLabel("Text / rich text", { exact: true }),
    ).toHaveValue("Nested duplicate only");
    await page.unroute("**/api/draft");
    const list = all.find((n) => n.kind === "list")!;
    const secondItem = list.children[1];
    await select(page, secondItem.id);
    await page.getByRole("button", { name: "Move up", exact: true }).click();
    await select(page, "channels");
    await page.getByLabel("Hidden from public site", { exact: true }).check();
    await page
      .getByRole("button", { name: "Publish content", exact: true })
      .click();
    await expect(notice).toContainText("Published content");
    const anon = await browser.newContext();
    const fresh = await anon.newPage();
    await fresh.goto("/");
    await expect(fresh.getByRole("heading", { level: 1 })).toHaveText(
      "Temporary hero-title",
    );
    expect((await fresh.request.get(src)).status()).toBe(200);
    await expect(fresh.locator(".academic-section")).toHaveCount(8);
    await expect(fresh.locator(".section-nav a")).toHaveCount(8);
    await expect(fresh.locator('.section-nav a[href="#channels"]')).toHaveCount(
      0,
    );
    await expect(fresh.locator(`#${list.id} li`).first()).toHaveText(
      secondItem.text,
    );
    await anon.close();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export JSON", exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe(
      "porter-content-backup.json",
    );
    await page.locator(".tree-controls input[type=file]").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    await expect(problem).toContainText("Import rejected");
    await page.locator(".tree-controls input[type=file]").setInputFiles({
      name: "restore.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(original)),
    });
    await expect(notice).toContainText("Validated backup imported");
    await page
      .getByRole("button", { name: "Publish content", exact: true })
      .click();
    await expect(notice).toContainText("Published content");
    expect(
      (await (await request.get("/api/published")).json()).content,
    ).toEqual(original);
  } finally {
    const latest = await (await page.request.get("/api/draft")).json();
    const restore = await page.request.post("/api/publish", {
      headers: { Origin: origin, "x-csrf-token": latest.csrf },
      data: { content: original, version: latest.version },
    });
    expect(restore.ok()).toBe(true);
  }
});
test("valid HTML nesting on every route, so hydration cannot break", async ({
  page,
}) => {
  const invalid = [
    "p div",
    "p p",
    "p ul",
    "p ol",
    "p table",
    "p section",
    "p article",
    "p figure",
    "p blockquote",
    "p details",
    "p h1",
    "p h2",
    "p h3",
    "p h4",
    "h1 div",
    "h2 div",
    "h3 div",
    "h4 div",
    "h1 p",
    "h2 p",
    "h3 p",
    "h4 p",
    "ul > :not(li):not(script):not(template)",
    "ol > :not(li):not(script):not(template)",
    "a a",
    "button button",
    "button a",
    "a button",
    "label label",
  ];
  const scan = async (label: string) => {
    const found = await page.evaluate(
      (selectors) =>
        selectors.flatMap((s) =>
          [...document.querySelectorAll(s)].map(
            (e) =>
              `${s} -> <${e.tagName.toLowerCase()} class="${(e as HTMLElement).className}">`,
          ),
        ),
      invalid,
    );
    expect(found, `invalid nesting in ${label}`).toEqual([]);
  };
  await page.goto("/");
  await scan("public site");
  await page.goto("/report");
  await scan("academic report");
  await signIn(page);
  await scan("owner editor");
});
