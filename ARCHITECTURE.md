# Architecture and content model

## Stack

- **Next.js (App Router) + React 19 + TypeScript**, server-rendered.
- **SQLite via `node:sqlite`** — Node's built-in driver, so there is no native compile
  step, no ORM and no database server.
- **Zod** for the content schema, **sanitize-html** for rich text.
- **Playwright + @axe-core/playwright** for browser and accessibility tests;
  **node:test** for unit and integration tests.

Files:

```
app/
  page.tsx              /        public interactive site (force-dynamic)
  report/page.tsx       /report  same canonical content, report mode
  owner/page.tsx        /owner   sign-in + editor (client component)
  api/[action]/route.ts JSON API
  assets/[id]/route.ts  uploaded image delivery
  globals.css           the whole design system, including A4 print CSS
components/
  PublicSite.tsx        renders the canonical content — public, report and editor preview
  Editor.tsx            owner workspace: tree, preview, inspector
lib/
  model.ts              Block/Site types, Zod schema, tree operations, checklist
  db.ts                 schema, auth, sessions, draft/publish writes
  sanitise.ts           rich-text and site validation
  seed.json             generated canonical starting content
scripts/
  create-seed.ts        builds lib/seed.json from website.txt
  setup.ts              idempotent migrate + seed + local secret bootstrap
  sync-build-seed.ts    build-session only: push seed into the database
  run.cjs               tiny TypeScript loader for the scripts and unit tests
```

## Content model

Everything on the site is one recursive tree of `Block` nodes. There are no hardcoded
content strings in the components — `PublicSite.tsx` is a renderer, not a document.

```ts
type Block = {
  id: string; // stable, unique across the whole tree
  kind: Kind; // section | paragraph | kpi | reference | stage | peso | ...
  label: string; // the owner-facing name shown in the tree and inspector
  text: string; // the editable rich text
  children: Block[]; // nested blocks, each with its own id
  config: Config; // per-kind data: image src/alt/fit, refId, counts, marker...
  style: Style; // per-instance typography and layout, plus mobile overrides
  hidden: boolean; // hidden from the public site, still editable
  reportOnly: boolean; // rendered only in /report
};
type Site = { schemaVersion: 1; root: Block };
```

`Kind` covers the full specification: site, section, hero, group, card, heading,
paragraph, list, quote, table, row, cell, image, button, divider, evidence, reference,
citation, kpi, interaction, option, timeline, moment, stage, peso, channel, survey,
scale, icon, footer, metadata and theme.

The root's direct children are: assignment metadata, global theme, navigation, hero,
the occasion interaction, the nine academic sections (`introduction`, `research`,
`insights`, `persona`, `journey`, `peso`, `channels`, `measurement`, `references`), the
journey summary and the footer.

### Independence guarantees

- **Every node has a stable unique ID.** The Zod schema rejects a tree containing a
  duplicate ID, so an invalid import or a bad duplication cannot be saved.
- **All edits are addressed by ID.** `editById` walks the tree and rebuilds only the path
  to the target; nothing is matched by visible text, array index, CSS selector, shared
  placeholder value or image URL.
- **`duplicate()` deep-copies and re-IDs** every nested descendant, so a duplicated KPI's
  "Proposed target" child is independent of the original's.
- Two nodes that happen to start with identical wording or the same placeholder image are
  separate records and stay separate.
- The only intentional sharing is by design and by reference: `/report` reads the same
  published tree as `/`, and a `citation` node points at a `reference` node through
  `config.refId`.

### Named, human-readable IDs

Sections, the hero, both remaining image slots and the reference records use stable named
IDs (`hero-title`, `porter-hero-image`, `porter-product-image-1`, `mia-persona-image`,
`ref-eighty20`, …). Generated blocks use `content-N`, assigned deterministically by
`create-seed.ts`, so regenerating the seed after a copy edit does not renumber anything.

## Storage schema

| Table            | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `migrations`     | Applied schema version                                         |
| `owner`          | Single row; scrypt password hash with per-hash salt            |
| `sessions`       | SHA-256 hashes of session tokens with expiry (8 hours)         |
| `snapshots`      | Append-only published versions                                 |
| `site`           | Single row: current `draft`, `version` counter, `published_id` |
| `assets`         | Uploaded image metadata; bytes live in `data/uploads/<uuid>`   |
| `login_attempts` | Rate limiting: 10 failures locks sign-in for 15 minutes        |

WAL journal mode; a 5-second busy timeout; reads open the database read-only.

## Publication model

- `readPublished()` joins `site.published_id` to `snapshots` — this is the **only** thing
  `/`, `/report` and `GET /api/published` ever read. A draft cannot leak.
- `readDraft()` requires a valid session.
- `writeContent(content, version, publish)` runs in a `BEGIN IMMEDIATE` transaction. It
  validates the tree, compares `version` against the stored counter and throws
  `CONFLICT: …` (HTTP 409) if another tab or session has saved in the meantime. On
  publish it inserts a new snapshot and repoints `published_id` in the same transaction,
  so the public swap is atomic.
- `initialise()` inserts the seed **only when the `site` row is absent**, so setup can be
  re-run safely and never resets owner edits. Anonymous requests never touch this path.
- Pages are `force-dynamic` and the API sends `Cache-Control: no-store`, so a refresh
  after publishing shows the new content immediately.
- A failed write surfaces the server's message in the editor's alert region and leaves the
  in-memory draft untouched — there is no optimistic "Saved".

## Security

- **Server-side authorisation, not hidden buttons.** Every mutating route re-checks the
  session cookie server-side; hiding editor UI is treated as cosmetic only.
- Session cookie: `HttpOnly`, `SameSite=strict`, `Secure` when `COOKIE_SECURE=true`,
  8-hour expiry. Only the SHA-256 hash of the token is stored.
- CSRF: every write requires an `x-csrf-token` header equal to
  `HMAC-SHA256(SESSION_SECRET, sessionToken)`, plus an exact `Origin` match against
  `APP_ORIGIN`.
- `requireConfig()` **fails closed**: absent or short `SESSION_SECRET`, absent
  `APP_ORIGIN`, a non-loopback origin without HTTPS, or HTTPS without secure cookies all
  throw before any work happens. No password is hardcoded anywhere in source.
- Uploads are validated by magic-byte signature _and_ declared MIME type, capped at 5 MB,
  and stored outside the web root under a random UUID. `/assets/<id>` serves a file only
  if that ID appears in the **published** tree, or the requester is the signed-in owner —
  so a draft-only image is not publicly reachable.
- Rich text passes through `sanitize-html` on the server; `safeUrl()` rejects
  `javascript:`, `data:` and protocol-relative URLs.

## Theming

Colour flows through two layers, which is what lets one palette edit restyle the
whole interface in both themes.

1. **Palette (owner data).** The `theme` node holds seven light colours and
   seven `Dark …` counterparts. `PublicSite` writes them as inline custom
   properties (`--cream`, `--dark-cream`, …) on the `.site` element.
2. **Semantic roles (CSS).** `app/globals.css` maps those to roles — `--surface`,
   `--ink`, `--accent`, `--panel-blue`, `--line`, `--ink-muted`, `--on-accent`,
   `--focus` and friends. Components only ever reference the roles.

`:root` defines the roles as literal defaults so the page background and anything
outside the site shell always paints. `.site` then re-derives the palette-backed
roles from the inline variables — this second declaration is essential, because a
`var(--cream)` written on `:root` could not see a property set further down the
tree. `[data-theme="dark"] .site` does the same from the `--dark-*` set.

`<html data-theme>` is written before first paint by a small inline script in
`app/layout.tsx` and toggled by `components/ThemeToggle.tsx`. The toggle keeps no
React state: it reads and writes the attribute directly and CSS reveals whichever
of its two labels matches, so there is nothing to hydrate and no wrong-label
flash. `color-scheme` is set per theme so form controls and scrollbars follow.

The `@media print` block redefines every role back to a light value on both
layers, so a reader printing in dark mode still gets a legible report.

One thing worth knowing: the hero photograph sits behind a cream overlay tuned
for a light page. In dark mode that same overlay over a light photograph left a
washed mid-grey that dropped the buttons to about 3.3:1 — a contrast failure axe
cannot see, because the background is an image. Dark mode therefore darkens the
photograph itself (`filter: brightness(0.4)`) and leaves the owner's overlay
setting untouched.

## Rendering modes

`PublicSite` renders the same tree in three modes through one context:

| Mode      | Used by            | Behaviour                                                         |
| --------- | ------------------ | ----------------------------------------------------------------- |
| public    | `/`                | Interactive: tabs, disclosures, PESO filter, occasion, progress   |
| `report`  | `/report`          | Everything expanded, `reportOnly` blocks shown, TOC, A4 print CSS |
| `editing` | the editor preview | Everything expanded and selectable; links and demos inert         |

This is why there is no second copy of the assignment text: the report is the same
canonical content with disclosures forced open and interaction chrome suppressed.

## Final layout overrides

The two late repairs in `website.txt` are implemented as the original design, not as
patches:

- **Hero** — one ordinary `<img>` behind the content with `object-fit: cover`, a separate
  cream overlay element, dark-brown/burgundy foreground text, no right-hand image card.
  The image keeps its own independent editable slot (`porter-hero-image`).
- **Products row** — a single centred responsive collage (`porter-product-image-1`) with
  `object-fit: contain` and `height: auto`. `porter-product-image-2` and
  `porter-product-image-3` do not exist in the content model at all, so no empty
  containers or reserved grid space are rendered.

## Accessibility and motion

Semantic landmarks and heading order, a skip link, visible focus styles, keyboard-operable
tabs and disclosures, `aria-expanded` / `aria-pressed` / `aria-current`, Escape closing
drawers and restoring focus to the trigger, textual selected-state markers (a `✓` prefix,
not colour alone), ~44 px touch targets, wrapping long reference URLs, and horizontally
scrollable table wrappers. Transitions are 150–250 ms and `prefers-reduced-motion`
disables both them and smooth scrolling. Axe (wcag2a, wcag2aa, wcag21aa) runs against the
public site at four widths and against the owner editor in the e2e suite.
