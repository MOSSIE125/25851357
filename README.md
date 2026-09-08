# Porter — A Digital Journey

An independent Stellenbosch University Digital Marketing Assignment 1 website about
Porter Luxury Carriers, built as a standalone TypeScript application with a public
interactive experience, a printable full academic report and an owner-only manual
content editor backed by a local SQLite database.

This is a student academic project. It is **not** the official Porter website, not a
shop and not affiliated with Porter Luxury Carriers.

The authoritative content and functional specification is `website.txt`. It is the
original AI prompt history and is deliberately **not published** in this
repository; it stays on the author's machine. When present it must not be
edited, and a unit test asserts its SHA-256 digest is unchanged (the test skips
when the file is absent). `npm run seed` needs it; the generated
[`lib/seed.json`](lib/seed.json) is committed, so nothing else does.

## Requirements

- **Node.js 24** or newer (the app uses the built-in `node:sqlite` module — no native
  build step, no external database server).
- npm 11 or newer.
- No cloud account, API key or paid service is required. Everything runs locally.

## Quick start

```bash
npm install          # install dependencies
npm run setup        # create the database, seed content and generate local secrets
npm run browsers     # one-off: install Chromium into ./.playwright (only needed for e2e)
npm run dev          # development server on http://127.0.0.1:3000
```

For a production-style run:

```bash
npm run build
npm run start        # http://127.0.0.1:3000
```

### Routes

| Route     | Who        | What                                                             |
| --------- | ---------- | ---------------------------------------------------------------- |
| `/`       | Anyone     | The interactive public site — all nine academic sections         |
| `/report` | Anyone     | Full academic report with table of contents and Print / Save PDF |
| `/owner`  | Owner only | Sign-in, then the "Edit website" workspace                       |

No login is required to read `/` or `/report`. The owner link is also in the site footer
("Owner access").

## Owner bootstrap and sign-in

`npm run setup` is **idempotent**: it creates the schema, inserts the bundled seed content
only if the site row is absent, and never overwrites later owner edits.

On a non-production machine it also generates a random owner password and session secret
and writes them to a gitignored `.env.local` (mode `0600`). The secret is never printed to
the terminal. To read the generated password:

```bash
# PowerShell
Select-String -Path .env.local -Pattern '^OWNER_PASSWORD='
```

Sign in at `/owner` with that password.

### Changing or resetting the owner password

```bash
npm run owner:reset
```

This removes `OWNER_PASSWORD` from `.env.local`, generates a fresh one, re-hashes it and
revokes every existing session. **Content is preserved.** To choose your own password
instead, set `OWNER_PASSWORD` in `.env.local` yourself (at least 20 characters) and run
`npm run setup`.

### Production

Set `NODE_ENV=production`. Setup then **fails closed** if `OWNER_PASSWORD`,
`SESSION_SECRET` or `APP_ORIGIN` are absent — nothing is auto-generated. Set
`COOKIE_SECURE=true` when serving over HTTPS. See [`.env.example`](.env.example) for the
variable names and their meaning; it contains no real secrets.

## Editing the site

1. Footer → **Owner access** (or go to `/owner`) and sign in.
2. **Edit website** opens three panes: a searchable content tree, a live visual preview
   and a plain-language inspector.
3. Select an element in the preview or find it in the tree (search matches labels, text
   and IDs). Hidden tabs, accordion panels, interaction feedback and report-only content
   are all reachable from the tree without playing through the interactions. Links and
   demo buttons are inert while editing.
4. Change text, typography, layout, images, buttons, chart and scale data, or interaction
   content. "Change this element only" is the default; global palette, fonts and spacing
   live under the clearly-marked theme node.
5. **Save draft** stores your work privately. **Publish content** atomically replaces the
   public snapshot — only then do anonymous readers see the change.

Other controls: Undo/Redo for the current session, move up/down, duplicate (deep-copies
nested blocks with new IDs), add, hide/unhide, delete, Preview, Export JSON, validated
Import JSON, a "Finish your submission" readiness checklist and a built-in editing guide.

Uploads accept PNG, JPEG and WebP up to 5 MB, validated by file signature; a pasted image
URL is always an alternative. A failed upload keeps the previous image.

## Reading experience

**Light and dark theme.** A toggle sits in the site header and in the owner
editor header. With no stored choice the site follows the operating system
(`prefers-color-scheme`); once toggled, the choice is remembered per browser in
`localStorage` and applied before first paint, so there is no flash of the wrong
theme on load. Printing always produces the light palette on white paper,
whatever the reader has chosen on screen.

Both palettes are owner-editable under **Global theme**: the seven original
colours drive light mode and seven matching `Dark …` fields drive dark mode.
Everything else in the interface is derived from those through semantic tokens,
so changing `Dark cream` restyles every dark-mode surface at once.

**Back to top.** A floating button appears once the reader is well down the page,
returns to the top and moves keyboard focus to `<main>`. It is hidden when
printing and in the editor preview.

**Mobile.** Layouts are exercised at 375, 768, 1024 and 1440 px in both themes.
On small screens the header collapses to short labels on a single line, the hero
is capped so it does not fill the whole screen, tables stack into readable rows,
body copy stays at 16px, and every control meets the 24px minimum target size.

## Verification

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run format:check   # prettier
npm test               # unit / integration tests (node:test)
npm run build          # production build
npm run test:e2e       # Playwright end-to-end + axe accessibility
npm run export         # static GitHub Pages build, self-verifying
```

`npm run test:e2e` builds nothing itself — run `npm run build` first — then starts its own
production server on port **3100** and drives a real Chromium browser. It never reuses an
existing server, so it can run while `npm run dev` is up on port 3000 and can never
silently test a development server. It exercises the public interactions, the
report and print path, owner authentication, manual editing, field/image independence,
uploads, draft-versus-published isolation, CSRF and stale-version conflicts, failed-write
error handling, theme switching and persistence, the back-to-top control, HTML nesting
validity on every route, print quality (no clipped tables, no chrome, minimum 9 pt type,
light palette even in dark mode), mobile target sizes, and axe checks at 375, 768, 1024
and 1440 px in both light and dark themes.

The e2e suite makes temporary content changes and restores the original content in a
`finally` block, so it is safe to run against the working database.

## Deploying

GitHub Pages serves static files only — no Node, no SQLite, no sessions — so the
site is split across two places:

| What                              | Where                                              |
| --------------------------------- | -------------------------------------------------- |
| Public site and full report       | GitHub Pages (static, free)                        |
| Owner editor, uploads, publishing | A Node host running the container (see Dockerfile) |

### 1. GitHub Pages (the reader-facing site)

The repository is `25851357`, so Pages serves it from a sub-path and the build
must know that:

```bash
npm run snapshot   # write content/published.json from your latest Publish
npm run export     # build docs/ for https://<you>.github.io/25851357/
```

`npm run export` clears `.next` when it finishes, because the export build leaves
routing behind that would make a later `npm run start` redirect API requests.
Run `npm run build` again before `npm run start` or `npm run test:e2e`.

`npm run export` takes the **published** snapshot (not your draft), writes any
uploaded photographs out as real files, hides or redirects the owner-access
link, and verifies the result before finishing — it fails the build if a section
is missing or any link or asset lost the `/25851357` prefix, which is the usual
reason a Pages deploy renders unstyled.

Then, in the repository settings, set **Pages → Source → GitHub Actions**. The
included `.github/workflows/pages.yml` rebuilds and deploys on every push to
`main`. Change `NEXT_PUBLIC_BASE_PATH` in that workflow if you rename the
repository, or set it to `""` for a `<you>.github.io` repository or a custom
domain (`PAGES_CNAME` writes the CNAME file).

**The database never leaves your machine**, so the deployed site shows whatever
is in `content/published.json`. The routine is:

```
edit at /owner  →  Publish content  →  npm run snapshot  →  commit  →  push
```

`content/published.json` is committed on purpose: it is a readable diff of
exactly what changed in the assignment between deploys.

### 2. The owner editor online

The editor needs a server, so it runs from the `Dockerfile` on any host that
takes a container (Render, Fly.io, Railway, a VPS). Two things matter:

- **Mount a persistent volume at `/data`.** Without one, the database and every
  uploaded photograph are wiped on each redeploy. `DATABASE_PATH` defaults to
  `/data/site.sqlite` in the image and uploads are stored beside it.
- **Set the secrets.** Production fails closed without them:

  | Variable         | Value                                                 |
  | ---------------- | ----------------------------------------------------- |
  | `OWNER_PASSWORD` | at least 20 characters, your choice                   |
  | `SESSION_SECRET` | at least 32 random characters                         |
  | `APP_ORIGIN`     | the exact HTTPS origin, e.g. `https://x.onrender.com` |
  | `COOKIE_SECURE`  | `true`                                                |

The container runs `npm run setup` on start, which migrates, seeds only if the
site is empty, and never overwrites your edits.

Finally, set the repository variable `EDITOR_ORIGIN` to that host's origin so the
published site's footer "Owner access" link points at your live editor. Without
it the link is hidden rather than shipped as a 404.

## Regenerating the seed

`lib/seed.json` is generated from `website.txt` by `scripts/create-seed.ts`:

```bash
node scripts/run.cjs scripts/create-seed.ts   # rewrite lib/seed.json
node scripts/run.cjs scripts/sync-build-seed.ts   # push it into the local database
```

`sync-build-seed` overwrites the current draft **and** publishes it — use it only during a
build session, never on a database holding real student edits. Node IDs are deterministic,
so regenerating after a copy edit leaves every stable ID intact.

## Architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the content model, storage schema,
publication model and security notes.

## What still needs real-world input

The site is complete as software. The following are deliberately marked "Not supplied" /
"Evidence required" rather than invented, and are listed item-by-item in the owner's
"Finish your submission" panel:

- Student name, student number, module name and code, and lecturer.
- All Porter photographs (9 image slots, currently neutral placeholders).
- Google Forms survey metadata and aggregate results.
- Complete Harvard bibliographic details for all nine reference records.
- Instagram follower baseline confirmation and every other KPI baseline.
- Baseline online revenue for the 20% growth objective.

## Repository hygiene

`data/` (the SQLite database and uploaded files), `.env*` except `.env.example`, `.next/`,
`node_modules/`, `.playwright/`, `test-results/` and `playwright-report/` are gitignored.
No secrets, runtime database or uploaded assets are committed.
