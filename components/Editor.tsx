"use client";
import { useEffect, useRef, useState } from "react";
import PublicSite from "./PublicSite";
import ThemeToggle from "./ThemeToggle";
import {
  type Block,
  type Site,
  type Style,
  type Config,
  type Kind,
  flatten,
  find,
  duplicate,
  editById,
  kinds,
  checklist,
} from "@/lib/model";
import { siteSchema } from "@/lib/schema";
type ResponseData = {
  content: Site;
  version: number;
  csrf?: string;
  error?: string;
  src?: string;
};
function blank(kind: Kind): Block {
  const n: Block = {
    id: crypto.randomUUID(),
    kind,
    label: `New ${kind}`,
    text: kind === "divider" || kind === "image" ? "" : "New content",
    children: [],
    style: {},
    config: {},
    hidden: false,
    reportOnly: false,
  };
  if (kind === "image")
    n.config = {
      src: "/placeholder.svg",
      alt: "Image not supplied",
      caption: "Photograph not supplied",
      credit: "Not supplied",
      source: "",
      fit: "contain",
      position: "50% 50%",
      overlay: 0,
    };
  if (kind === "button")
    n.config = {
      action: "section",
      destination: "introduction",
      target: "_self",
      href: "",
    };
  if (kind === "citation") n.config = { refId: "" };
  if (kind === "scale") n.config = { min: 0, max: 100, marker: 50 };
  if (kind === "survey") {
    n.config = { denominator: 0, multiselect: false };
    n.children = [blank("option")];
    n.children[0].config.count = 0;
  }
  if (kind === "interaction") n.children = [blank("option")];
  if (kind === "option")
    n.children = [
      {
        ...blank("paragraph"),
        label: "Feedback",
        text: "Author-developed feedback",
      },
    ];
  if (kind === "list") n.children = [blank("paragraph")];
  if (kind === "table") {
    n.children = [blank("row")];
    n.children[0].children = [blank("cell"), blank("cell")];
  }
  if (kind === "card") n.children = [blank("paragraph")];
  if (kind === "reference")
    n.children = [
      "Author / organisation",
      "Year",
      "Suffix",
      "Title",
      "Publication / website",
      "Edition",
      "Volume / issue / pages",
      "URL / DOI",
      "Access date",
      "Source type",
      "Verification status",
      "Full reference override",
    ].map((label) => ({
      ...blank("paragraph"),
      label,
      text:
        label === "URL / DOI" ||
        label === "Full reference override" ||
        label === "Suffix"
          ? ""
          : "Not supplied",
    }));
  return n;
}
function contrast(fg: string, bg: string) {
  const lum = (hex: string) => {
    const rgb = hex
      .match(/[a-f0-9]{2}/gi)
      ?.map((x) => parseInt(x, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return rgb?.length === 3
      ? 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
      : 0;
  };
  const a = lum(fg),
    b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export default function Editor() {
  const [site, setSite] = useState<Site>();
  const [version, setVersion] = useState(0);
  const [csrf, setCsrf] = useState("");
  const [selected, setSelected] = useState("hero-title");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<Site[]>([]);
  const [future, setFuture] = useState<Site[]>([]);
  const [preview, setPreview] = useState(false);
  const [mode, setMode] = useState<"inspect" | "checklist" | "guide">(
    "inspect",
  );
  const [addKind, setAddKind] = useState<Kind>("paragraph");
  const [pendingDelete, setPendingDelete] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const current = site && find(site.root, selected);
  const dirty = !!site && JSON.stringify(site) !== saved;
  async function load() {
    const r = await fetch("/api/draft", { cache: "no-store" });
    const data = await r.json();
    if (r.ok) {
      setSite(data.content);
      setVersion(data.version);
      setCsrf(data.csrf);
      setSaved(JSON.stringify(data.content));
      setHistory([]);
      setFuture([]);
    } else if (r.status !== 401) setError(data.error);
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function request(action: string, body: unknown): Promise<ResponseData> {
    const r = await fetch(`/api/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || "Request failed");
    return data;
  }
  function change(next: Site) {
    if (!site) return;
    setHistory((h) => [...h.slice(-59), site]);
    setFuture([]);
    setSite(next);
    setStatus("");
    setPendingDelete(false);
  }
  function patch(fn: (n: Block) => void) {
    if (site && current) change(editById(site, current.id, fn));
  }
  function setStyle(key: keyof Style, v: string) {
    patch((n) => {
      const numeric = [
        "fontSize",
        "fontWeight",
        "lineHeight",
        "letterSpacing",
        "borderWidth",
        "borderRadius",
        "padding",
        "margin",
        "columns",
        "mobileFontSize",
        "mobilePadding",
      ].includes(key);
      if (!v) delete n.style[key];
      else Object.assign(n.style, { [key]: numeric ? Number(v) : v });
    });
  }
  function setConfig(key: keyof Config, v: string | number | boolean) {
    patch((n) => {
      Object.assign(n.config, { [key]: v });
    });
  }
  async function persist(publish: boolean) {
    if (!site) return;
    setBusy(true);
    setError("");
    try {
      siteSchema.parse(site);
      const result = await request(publish ? "publish" : "draft", {
        content: site,
        version,
      });
      setVersion(result.version);
      setSite(result.content);
      setSaved(JSON.stringify(result.content));
      setStatus(
        publish
          ? "Published content. Fresh public readers now receive this snapshot."
          : "Draft saved. Public content unchanged.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Save failed. Your changes remain in the editor.",
      );
    } finally {
      setBusy(false);
    }
  }
  function exportJson() {
    if (!site) return;
    const blob = new Blob([JSON.stringify(site, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "porter-content-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function importJson(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw Error("Backup exceeds 5 MB.");
      const result = siteSchema.parse(JSON.parse(await file.text()));
      change(result);
      setSelected(result.root.id);
      setStatus(
        "Validated backup imported into the editor. Save draft or publish when ready.",
      );
      setError("");
    } catch (e) {
      setError(
        `Import rejected: ${e instanceof Error ? e.message : "Invalid JSON"}`,
      );
    }
  }
  function sibling(action: "up" | "down" | "duplicate" | "delete") {
    if (!site || !current) return;
    const next = structuredClone(site);
    const parent = flatten(next.root).find((n) =>
      n.children.some((c) => c.id === current.id),
    );
    if (!parent) {
      setError("The root cannot be moved, duplicated or deleted.");
      return;
    }
    const index = parent.children.findIndex((c) => c.id === current.id);
    if (action === "duplicate") {
      const copy = duplicate(parent.children[index]);
      copy.label += " (copy)";
      parent.children.splice(index + 1, 0, copy);
      setSelected(copy.id);
    } else if (action === "delete") {
      parent.children.splice(index, 1);
      setSelected(parent.id);
    } else {
      const other = index + (action === "up" ? -1 : 1);
      if (other < 0 || other >= parent.children.length) return;
      [parent.children[index], parent.children[other]] = [
        parent.children[other],
        parent.children[index],
      ];
    }
    change(next);
  }
  function format(tag: string) {
    const input = textRef.current;
    if (!input || !current) return;
    const start = input.selectionStart,
      end = input.selectionEnd;
    const selected = current.text.slice(start, end) || "text";
    const open =
      tag === "colour"
        ? '<span style="color: #7b2035">'
        : tag === "link"
          ? '<a href="https://example.com">'
          : `<${tag}>`;
    const close = tag === "colour" ? "span" : tag === "link" ? "a" : tag;
    patch((n) => {
      n.text =
        n.text.slice(0, start) +
        open +
        selected +
        `</${close}>` +
        n.text.slice(end);
    });
    input.focus();
  }
  async function measure(file: File) {
    try {
      const bitmap = await createImageBitmap(file);
      const ratio = `${bitmap.width}/${bitmap.height}`;
      bitmap.close();
      return ratio;
    } catch {
      return undefined;
    }
  }
  async function upload(file?: File) {
    if (!file || !current) return;
    const selectedId = current.id;
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "x-csrf-token": csrf },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      // Measure the picture in the browser so the public page can reserve the
      // right space for it before it loads. The owner can still override the
      // aspect ratio by hand in the inspector.
      const ratio = await measure(file);
      if (site)
        change(
          editById(site, selectedId, (n) => {
            n.config.src = data.src;
            if (ratio) n.config.aspectRatio = ratio;
          }),
        );
      setStatus(
        "Image uploaded. Save draft or publish to retain the slot change.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Upload failed. Previous image retained.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!site)
    return (
      <main className="owner-login">
        <a href="/" className="wordmark">
          PORTER
        </a>
        <p className="eyebrow">Owner workspace</p>
        <h1>Make the story yours.</h1>
        <p>
          Sign in to edit the assignment, manage images and publish content.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await request("login", { password });
              setPassword("");
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Sign-in failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="password">Owner password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <p className="note">
          For this local installation, the generated owner password is stored in
          .env.local. See README.md for setup and reset instructions.
        </p>
        <a href="/">Return to the public website</a>
      </main>
    );
  const all = flatten(site.root);
  const issues = checklist(site);
  const filtered = all.filter((n) =>
    `${n.id} ${n.label} ${n.text}`.toLowerCase().includes(search.toLowerCase()),
  );
  const configKeys: Partial<Record<Kind, (keyof Config)[]>> = {
    image: [
      "src",
      "alt",
      "caption",
      "credit",
      "source",
      "fit",
      "aspectRatio",
      "height",
      "position",
      "overlay",
    ],
    button: ["action", "href", "destination", "target"],
    citation: ["refId"],
    survey: ["denominator", "multiselect"],
    option: ["count"],
    scale: ["min", "max", "marker"],
    icon: ["icon", "opacity"],
    interaction: ["defaultId"],
  };
  return (
    <div className="editor-shell">
      <header className="editor-header">
        <div>
          <a href="/" className="wordmark">
            PORTER
          </a>
          <h1>Edit website</h1>
          <span className="draft-state">
            {dirty ? "Unsaved changes" : "All changes saved"} · Version{" "}
            {version}
          </span>
        </div>
        <div className="editor-toolbar">
          <button
            onClick={() => {
              if (history.length) {
                setFuture((f) => [site, ...f]);
                setSite(history.at(-1));
                setHistory((h) => h.slice(0, -1));
              }
            }}
            disabled={!history.length}
          >
            Undo
          </button>
          <button
            onClick={() => {
              if (future.length) {
                setHistory((h) => [...h, site]);
                setSite(future[0]);
                setFuture((f) => f.slice(1));
              }
            }}
            disabled={!future.length}
          >
            Redo
          </button>
          <button onClick={() => setPreview(!preview)}>
            {preview ? "Return to editor" : "Preview"}
          </button>
          <button disabled={busy} onClick={() => persist(false)}>
            Save draft
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => persist(true)}
          >
            Publish content
          </button>
          <ThemeToggle />
          <button
            onClick={async () => {
              try {
                await request("logout", {});
                setSite(undefined);
                setCsrf("");
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="editor-notices" aria-live="polite">
        {status && <p role="status">{status}</p>}
        {error && (
          <div role="alert" className="error">
            <p>{error}</p>
            {error.includes("CONFLICT") && (
              <button
                onClick={() => {
                  exportJson();
                  void load();
                  setError("");
                }}
              >
                Export my changes and load latest draft
              </button>
            )}
          </div>
        )}
      </div>
      {preview ? (
        <>
          <p className="preview-banner">
            Private preview of your current editor content. Nothing is published
            by previewing.
          </p>
          <PublicSite site={site} />
        </>
      ) : (
        <div className="editor-grid">
          <aside className="content-tree">
            <label htmlFor="tree-search">Find any content</label>
            <input
              id="tree-search"
              placeholder="Search labels, text or IDs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="tree-controls">
              <button
                onClick={() => {
                  setMode("checklist");
                }}
              >
                Finish your submission ({issues.length})
              </button>
              <button onClick={() => setMode("guide")}>Editing guide</button>
              <button onClick={exportJson}>Export JSON</button>
              <label className="file-control">
                Import JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    void importJson(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <nav aria-label="Content tree">
              {filtered.map((n) => (
                <button
                  className={n.id === selected ? "selected" : ""}
                  key={n.id}
                  data-tree-id={n.id}
                  onClick={() => {
                    setSelected(n.id);
                    setMode("inspect");
                    setPendingDelete(false);
                  }}
                >
                  <span>
                    {n.kind}
                    {n.hidden ? " · hidden" : ""}
                    {n.reportOnly ? " · report only" : ""}
                  </span>
                  {n.label}
                  <small>{n.id}</small>
                </button>
              ))}
            </nav>
          </aside>
          {/* The preview is the editor's primary content; the tree and
              inspector beside it are complementary landmarks. */}
          <main className="visual-preview" aria-label="Visual preview">
            <p className="preview-banner">
              Select an element to edit it. Links and demonstrations are
              disabled in selection mode.
            </p>
            <PublicSite
              site={site}
              editing
              selected={selected}
              onSelect={(id) => {
                setSelected(id);
                setMode("inspect");
              }}
            />
          </main>
          <aside className="inspector" aria-label="Content inspector">
            {mode === "guide" ? (
              <>
                <h2>Editing guide</h2>
                <p>
                  Owner access → sign in → Edit website → select an element or
                  search the content tree → change its fields → Save draft →
                  Publish content → check the public website.
                </p>
                <p>
                  Individual settings affect only the selected ID. Global theme
                  changes affect the whole site. The report intentionally shares
                  the same academic records.
                </p>
                <p>
                  Select hidden options, tabs, feedback and evidence directly in
                  the tree. Rich text supports bold, italic, underline, links
                  and coloured spans. Select text, then use the formatting
                  buttons; edit the link or colour in the marked-up text field.
                </p>
                <p>
                  Images accept local PNG, JPEG or WebP uploads up to 5 MB, or
                  existing HTTP / HTTPS URLs. Replacing one slot never
                  overwrites another image file. Captions, credits and sources
                  are independent.
                </p>
                <p>
                  Add a reference block in Evidence Base, complete its fields,
                  then select it in a citation’s Reference control. The
                  checklist identifies incomplete, missing, unused and
                  inconsistent citations.
                </p>
                <p>
                  Save draft keeps public content unchanged. Publish content
                  updates the public snapshot; it does not deploy the
                  application. A stale editor must export its changes and reload
                  before saving. JSON backups contain content and image paths,
                  not uploaded image bytes; back up the data folder too.
                </p>
                <p>
                  Preview lets you try unsaved content privately. Full Academic
                  Report always uses published content and provides browser
                  Print / Save as PDF. Undo and redo are limited to this editor
                  session.
                </p>
              </>
            ) : mode === "checklist" ? (
              <>
                <h2>Finish your submission</h2>
                <p>
                  Missing evidence remains visible. Check methodology against
                  the work actually conducted.
                </p>
                {issues.length === 0 ? (
                  <p>
                    No automatic missing-field flags. Manually verify every
                    source and claim.
                  </p>
                ) : (
                  issues.map((item, i) => (
                    <button
                      className="checklist-item"
                      key={`${item.id}-${i}`}
                      onClick={() => {
                        setSelected(item.id);
                        setMode("inspect");
                      }}
                    >
                      {item.message}
                    </button>
                  ))
                )}
              </>
            ) : (
              current && (
                <>
                  <p className="eyebrow">Change this element only</p>
                  <h2>{current.label}</h2>
                  <code className="stable-id">{current.id}</code>
                  {current.kind === "theme" && (
                    <p className="warning">
                      Global settings affect the whole site.
                    </p>
                  )}
                  <label>
                    Element name
                    <input
                      value={current.label}
                      onChange={(e) =>
                        patch((n) => {
                          n.label = e.target.value;
                        })
                      }
                    />
                  </label>
                  <div className="field">
                    <label htmlFor="inspector-text">Text / rich text</label>
                    <textarea
                      id="inspector-text"
                      ref={textRef}
                      value={current.text}
                      onChange={(e) =>
                        patch((n) => {
                          n.text = e.target.value;
                        })
                      }
                      rows={6}
                    />
                  </div>
                  <div className="format-buttons">
                    {[
                      ["b", "Bold"],
                      ["i", "Italic"],
                      ["u", "Underline"],
                      ["link", "Link"],
                      ["colour", "Text colour"],
                    ].map(([tag, label]) => (
                      <button key={tag} onClick={() => format(tag)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {current.children.length > 0 && (
                    <details open>
                      <summary>Nested fields</summary>
                      {current.children.map((c) => (
                        <button
                          key={c.id}
                          className="child-link"
                          onClick={() => setSelected(c.id)}
                        >
                          {c.label} →
                        </button>
                      ))}
                    </details>
                  )}
                  {current.kind === "image" && (
                    <label className="file-control">
                      Upload replacement image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={busy}
                        onChange={(e) => void upload(e.target.files?.[0])}
                      />
                    </label>
                  )}
                  {(configKeys[current.kind] || []).map((key) => {
                    const label: Partial<Record<keyof Config, string>> = {
                      src: "Image URL",
                      alt: "Alternative text",
                      caption: "Caption",
                      credit: "Image credit",
                      source: "Source URL",
                      fit: "Image fit",
                      position: "Focal point (for example 50% 50%)",
                      overlay: "Overlay intensity (0 to 1)",
                      refId: "Reference",
                      destination: "Section / panel destination",
                      defaultId: "Default option",
                      count: "Option count",
                      denominator: "Valid response count",
                    };
                    const val = current.config[key];
                    const options =
                      key === "fit"
                        ? ["cover", "contain"]
                        : key === "action"
                          ? ["section", "report", "reveal", "url"]
                          : key === "target"
                            ? ["_self", "_blank"]
                            : key === "icon"
                              ? ["✦", "○", "◇", "+", "→"]
                              : undefined;
                    const nodes =
                      key === "refId"
                        ? all.filter((n) => n.kind === "reference")
                        : key === "destination"
                          ? all.filter(
                              (n) =>
                                n.kind === "section" ||
                                n.kind === "group" ||
                                n.kind === "card" ||
                                n.kind === "interaction",
                            )
                          : key === "defaultId"
                            ? current.children.filter(
                                (n) => n.kind === "option",
                              )
                            : undefined;
                    return (
                      <label key={key}>
                        {label[key] || key}
                        {nodes ? (
                          <select
                            aria-label={label[key] || key}
                            value={String(val || "")}
                            onChange={(e) => setConfig(key, e.target.value)}
                          >
                            <option value="">None / manual</option>
                            {nodes.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.label}
                                {n.hidden ? " (hidden)" : ""}
                              </option>
                            ))}
                          </select>
                        ) : options ? (
                          <select
                            aria-label={label[key] || key}
                            value={String(val || options[0])}
                            onChange={(e) => setConfig(key, e.target.value)}
                          >
                            {options.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : key === "multiselect" ? (
                          <input
                            type="checkbox"
                            checked={!!val}
                            onChange={(e) => setConfig(key, e.target.checked)}
                          />
                        ) : (
                          <input
                            type={
                              [
                                "height",
                                "overlay",
                                "count",
                                "denominator",
                                "min",
                                "max",
                                "marker",
                                "opacity",
                              ].includes(key)
                                ? "number"
                                : "text"
                            }
                            step={
                              key === "overlay" || key === "opacity"
                                ? ".05"
                                : "any"
                            }
                            value={val === undefined ? "" : String(val)}
                            onChange={(e) => {
                              if (e.target.value === "") {
                                patch((n) => {
                                  delete n.config[key];
                                });
                              } else
                                setConfig(
                                  key,
                                  e.target.type === "number"
                                    ? Number(e.target.value)
                                    : e.target.value,
                                );
                            }}
                          />
                        )}
                      </label>
                    );
                  })}
                  <details>
                    <summary>Typography and layout</summary>
                    <p>
                      Blank values inherit defaults. Mobile overrides apply
                      below 600px.
                    </p>
                    {(["color", "backgroundColor", "borderColor"] as const).map(
                      (key) => (
                        <label key={key}>
                          {
                            {
                              color: "Text colour",
                              backgroundColor: "Background colour",
                              borderColor: "Border colour",
                            }[key]
                          }
                          <div className="colour-input">
                            <input
                              aria-label={`${key} picker`}
                              type="color"
                              value={current.style[key] || "#30271f"}
                              onChange={(e) => setStyle(key, e.target.value)}
                            />
                            <input
                              aria-label={`${key} hex`}
                              value={current.style[key] || ""}
                              placeholder="#30271F"
                              onChange={(e) => setStyle(key, e.target.value)}
                            />
                          </div>
                        </label>
                      ),
                    )}
                    {contrast(
                      current.style.color || "#30271f",
                      current.style.backgroundColor || "#f7f3eb",
                    ) < 4.5 && (
                      <p className="warning">
                        Contrast warning: this colour pair is below 4.5:1 for
                        normal text.
                      </p>
                    )}
                    <label>
                      Font family
                      <select
                        aria-label="Font family"
                        value={current.style.fontFamily || ""}
                        onChange={(e) => setStyle("fontFamily", e.target.value)}
                      >
                        <option value="">Inherit</option>
                        {[
                          "Georgia, serif",
                          "Arial, sans-serif",
                          "Verdana, sans-serif",
                          "Times New Roman, serif",
                        ].map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Alignment
                      <select
                        aria-label="Alignment"
                        value={current.style.textAlign || ""}
                        onChange={(e) => setStyle("textAlign", e.target.value)}
                      >
                        <option value="">Inherit</option>
                        {["left", "center", "right"].map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                    </label>
                    {(
                      [
                        "fontSize",
                        "fontWeight",
                        "lineHeight",
                        "letterSpacing",
                        "borderWidth",
                        "borderRadius",
                        "padding",
                        "margin",
                        "width",
                        "maxWidth",
                        "columns",
                        "mobileFontSize",
                        "mobilePadding",
                      ] as const
                    ).map((key) => (
                      <label key={key}>
                        {
                          {
                            fontSize: "Font size (px)",
                            fontWeight: "Font weight",
                            lineHeight: "Line height",
                            letterSpacing: "Letter spacing (px)",
                            borderWidth: "Border width (px)",
                            borderRadius: "Corner radius (px)",
                            padding: "Padding (px)",
                            margin: "Margin (px)",
                            width: "Width (px, %, rem or auto)",
                            maxWidth: "Maximum width",
                            columns: "Column count",
                            mobileFontSize: "Mobile font size (px)",
                            mobilePadding: "Mobile padding (px)",
                          }[key]
                        }
                        <input
                          value={current.style[key] ?? ""}
                          onChange={(e) => setStyle(key, e.target.value)}
                          type={
                            key === "width" || key === "maxWidth"
                              ? "text"
                              : "number"
                          }
                          step="any"
                        />
                      </label>
                    ))}
                  </details>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={current.hidden}
                      onChange={(e) =>
                        patch((n) => {
                          n.hidden = e.target.checked;
                        })
                      }
                    />
                    Hidden from public site
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={current.reportOnly}
                      onChange={(e) =>
                        patch((n) => {
                          n.reportOnly = e.target.checked;
                        })
                      }
                    />
                    Report only
                  </label>
                  <div className="actions">
                    <button onClick={() => sibling("up")}>Move up</button>
                    <button onClick={() => sibling("down")}>Move down</button>
                    <button onClick={() => sibling("duplicate")}>
                      Duplicate
                    </button>
                    <button onClick={() => setPendingDelete(true)}>
                      Delete
                    </button>
                  </div>
                  {pendingDelete && (
                    <div className="warning">
                      <p>
                        Delete this block and all its nested fields from your
                        working draft?
                      </p>
                      <button onClick={() => sibling("delete")}>
                        Delete selected block
                      </button>
                      <button onClick={() => setPendingDelete(false)}>
                        Cancel
                      </button>
                    </div>
                  )}
                  <label>
                    Add a nested block
                    <select
                      aria-label="Add a nested block"
                      value={addKind}
                      onChange={(e) => setAddKind(e.target.value as Kind)}
                    >
                      {kinds
                        .filter(
                          (k) =>
                            ![
                              "site",
                              "hero",
                              "metadata",
                              "theme",
                              "footer",
                            ].includes(k),
                        )
                        .map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                    </select>
                  </label>
                  <button
                    onClick={() => {
                      const newNode = blank(addKind);
                      patch((n) => n.children.push(newNode));
                      setSelected(newNode.id);
                    }}
                  >
                    Add block
                  </button>
                  {current.kind === "theme" && (
                    <p>
                      Choose a nested theme field. Colours use six-digit hex;
                      fonts use the listed font stacks; spacing is in pixels;
                      animation is On or Off.
                    </p>
                  )}
                  {all.some(
                    (n) =>
                      n.kind === "theme" &&
                      n.children.some((c) => c.id === current.id),
                  ) && (
                    <p className="warning">
                      This is a global theme field. It affects the whole site.
                    </p>
                  )}
                  {current.kind === "citation" && (
                    <p>
                      References are intentional links to one logical source;
                      editing the source does not change other references.
                    </p>
                  )}
                  {current.kind === "image" && (
                    <p>
                      Existing uploads remain in the asset library. Paste a
                      previous /assets/ URL to reuse a file without linking the
                      slots.
                    </p>
                  )}
                </>
              )
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
