"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  type Block,
  type Site,
  child,
  value,
  flatten,
  safeUrl,
} from "@/lib/model";
import { url } from "@/lib/paths";
import ThemeToggle from "./ThemeToggle";
import ScrollToTop from "./ScrollToTop";
type Context = {
  site: Site;
  report: boolean;
  editing: boolean;
  occasion: string;
  setOccasion: (v: string) => void;
  visited: Set<string>;
  visit: (id: string) => void;
  peso: string;
  setPeso: (v: string) => void;
  selected?: string;
  onSelect?: (id: string) => void;
};
const ContentContext = createContext<Context>(null!);
export function Rich({ text }: { text: string }) {
  const tokens = text.split(/(<\/?(?:b|strong|i|em|u|span|a|br)\b[^>]*>)/gi);
  let at = 0;
  const parse = (closing?: string): ReactNode[] => {
    const result: ReactNode[] = [];
    while (at < tokens.length) {
      const t = tokens[at++];
      const end = t.match(/^<\/(\w+)/);
      if (end) {
        if (closing) return result;
        continue;
      }
      const tag = t.match(/^<(\w+)/)?.[1]?.toLowerCase();
      if (tag === "br") {
        result.push(<br key={at} />);
        continue;
      }
      if (tag) {
        const key = at;
        const inner = parse(tag);
        if (tag === "a") {
          const href = t.match(/href=["']([^"']*)/)?.[1] || "";
          result.push(
            safeUrl(href) ? (
              <a key={key} href={href} rel="noopener noreferrer">
                {inner}
              </a>
            ) : (
              <span key={key}>{inner}</span>
            ),
          );
        } else if (tag === "span") {
          const color = t.match(/color:\s*(#[0-9a-f]{6})/i)?.[1];
          result.push(
            <span key={key} style={{ color }}>
              {inner}
            </span>,
          );
        } else result.push(React.createElement(tag, { key }, inner));
      } else
        result.push(
          t
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'"),
        );
    }
    return result;
  };
  return <>{parse()}</>;
}
function styles(n: Block): CSSProperties {
  const { columns, mobileFontSize, mobilePadding, ...style } = n.style;
  return {
    ...style,
    display: columns ? "grid" : undefined,
    gridTemplateColumns: columns
      ? `repeat(${columns},minmax(0,1fr))`
      : undefined,
    "--mobile-font": mobileFontSize ? `${mobileFontSize}px` : undefined,
    "--mobile-padding":
      mobilePadding !== undefined ? `${mobilePadding}px` : undefined,
  } as CSSProperties;
}
function Children({ node }: { node: Block }) {
  return (
    <>
      {node.children.map((c) => (
        <Render
          key={c.id}
          node={c}
          labelled={node.kind === "group" && node.label === "Complete persona"}
        />
      ))}
    </>
  );
}
function Field({
  node,
  showLabel = false,
}: {
  node: Block;
  showLabel?: boolean;
}) {
  return (
    <div className="text-field">
      {showLabel && <strong className="field-label">{node.label}</strong>}
      <div className="rich">
        <Rich text={node.text || "Not supplied"} />
      </div>
      <Children node={node} />
    </div>
  );
}
// The bundled placeholder is 1600x900. Giving the <img> width and height lets
// the browser reserve the right space before the file arrives, which is what
// stops a layout shift. We only claim dimensions we actually know: an explicit
// aspect ratio if the owner set one, the placeholder's own size when that is
// what is being shown, and nothing at all for an upload of unknown shape —
// guessing there would cause the very shift this avoids. The editor records an
// aspect ratio automatically when a photograph is uploaded.
const placeholder = { width: 1600, height: 900 };
function intrinsic(c: Block["config"], usingPlaceholder: boolean) {
  const ratio = c.aspectRatio?.trim();
  if (ratio) {
    const [w, h] = ratio.split("/").map((n) => Number(n.trim()));
    if (w > 0 && h > 0)
      return { width: Math.round(w * 100), height: Math.round(h * 100) };
    const single = Number(ratio);
    if (single > 0) return { width: Math.round(single * 1000), height: 1000 };
  }
  return usingPlaceholder ? placeholder : undefined;
}
function ImageBlock({ node, hero = false }: { node: Block; hero?: boolean }) {
  const c = node.config;
  // Resolve first, then ask whether we ended up on the placeholder. Testing
  // safeUrl alone was wrong: "/placeholder.svg" is itself a valid URL, and an
  // empty src passes validation too but must still fall back.
  const resolved = c.src && safeUrl(c.src) ? c.src : "/placeholder.svg";
  const usingPlaceholder = resolved === "/placeholder.svg";
  const size = intrinsic(c, usingPlaceholder);
  return (
    <figure
      className={`${hero ? "hero-image" : "image-block"} ${node.id === "porter-product-image-1" ? "collage" : ""}`}
    >
      <img
        src={url(resolved)}
        alt={c.alt || ""}
        width={size?.width}
        height={size?.height}
        loading={hero ? "eager" : "lazy"}
        style={{
          objectFit:
            node.id === "porter-product-image-1"
              ? "contain"
              : c.fit || "contain",
          height:
            node.id === "porter-product-image-1"
              ? "auto"
              : c.height
                ? `${c.height}px`
                : undefined,
          aspectRatio: c.aspectRatio,
          objectPosition: c.position,
          borderRadius: node.style.borderRadius,
        }}
      />
      {!hero && (
        <figcaption>
          {c.caption}
          {c.credit && c.credit !== "Not supplied" && <> · {c.credit}</>}
          {c.source && <a href={c.source}> Image source</a>}
        </figcaption>
      )}
    </figure>
  );
}
function Action({ node }: { node: Block }) {
  const ctx = useContext(ContentContext);
  const [open, setOpen] = useState(false);
  const c = node.config;
  let destination = c.destination;
  const target = destination
    ? flatten(ctx.site.root).find((n) => n.id === destination)
    : undefined;
  if (target?.hidden) destination = undefined;
  const href =
    c.action === "report"
      ? url("/report")
      : c.action === "section"
        ? destination
          ? `#${destination}`
          : "#main-content"
        : url(c.href || "#");
  if (c.action === "reveal")
    return (
      <>
        <button aria-expanded={open} onClick={() => setOpen(!open)}>
          {node.text}
        </button>
        {open && <Children node={node} />}
      </>
    );
  return (
    <a
      className="button"
      href={href}
      target={c.target}
      rel={c.target === "_blank" ? "noopener noreferrer" : undefined}
    >
      <Rich text={node.text} />
    </a>
  );
}
function Interaction({ node }: { node: Block }) {
  const ctx = useContext(ContentContext);
  // The occasion interaction is a direct child of the root, sitting between the
  // hero h1 and the first section h2, so it takes h2. Interactions nested in a
  // section stay at h3. Skipping a level breaks the document outline.
  const Heading = ctx.site.root.children.some((c) => c.id === node.id)
    ? "h2"
    : "h3";
  const [selected, setSelected] = useState(node.config.defaultId || "");
  const options = node.children.filter((c) => c.kind === "option" && !c.hidden);
  const picked = options.find((c) => c.id === selected);
  const choose = (option: Block) => {
    setSelected(option.id);
    if (node.id === "occasion") ctx.setOccasion(option.id);
  };
  return (
    <div className="interaction">
      <p className="eyebrow">
        {node.id === "occasion" ? "Choose an occasion" : "Explore the scenario"}
      </p>
      <Heading>
        <Rich text={node.text} />
      </Heading>
      <div className="choice-row">
        {options.map((o) => (
          <button
            key={o.id}
            aria-pressed={selected === o.id}
            onClick={() => choose(o)}
          >
            {selected === o.id ? "✓ Selected: " : ""}
            <Rich text={o.text} />
          </button>
        ))}
      </div>
      {picked && (
        <div className="feedback" role="status">
          <Children node={picked} />
        </div>
      )}
      {node.id === "occasion" && (
        <div className="actions">
          <button
            disabled={!selected}
            onClick={() =>
              document.getElementById("research")?.scrollIntoView()
            }
          >
            Continue →
          </button>
          <a href="#research">Skip to the research</a>
        </div>
      )}
      {ctx.report && (
        <p className="note">
          Interactive activity is an author-developed interpretation, not a
          research result.
        </p>
      )}
    </div>
  );
}
function Disclosure({ node, summary }: { node: Block; summary: string }) {
  const ctx = useContext(ContentContext);
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      open={ctx.report || ctx.editing || undefined}
      className="disclosure"
      onKeyDown={(e) => {
        if (e.key === "Escape" && ref.current) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>{summary}</summary>
      <div className="group">
        {node.text && <p>{node.text}</p>}
        <Children node={node} />
      </div>
    </details>
  );
}
function Evidence({ node }: { node: Block }) {
  const ctx = useContext(ContentContext);
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      open={ctx.report || ctx.editing || undefined}
      className="evidence"
      onKeyDown={(e) => {
        if (e.key === "Escape" && ref.current) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>View evidence</summary>
      <div>
        {node.children.map((c) => (
          <div key={c.id}>
            <Render node={c} labelled />
          </div>
        ))}
      </div>
    </details>
  );
}
function Timeline({ node }: { node: Block }) {
  const ctx = useContext(ContentContext);
  const moments = node.children.filter((c) => !c.hidden);
  const [active, setActive] = useState(moments[0]?.id);
  return (
    <div
      className={`timeline ${node.label.startsWith("A Day") ? "digital-day" : ""}`}
    >
      <h3>{node.label}</h3>
      {node.text && <p className="note">{node.text}</p>}
      {!ctx.report && !ctx.editing && (
        <div className="choice-row" aria-label={node.label}>
          {moments.map((m) => (
            <button
              key={m.id}
              aria-pressed={active === m.id}
              onClick={() => setActive(m.id)}
            >
              {active === m.id ? "✓ " : ""}
              {m.label}
            </button>
          ))}
        </div>
      )}
      {moments
        .filter((m) => ctx.report || ctx.editing || m.id === active)
        .map((m) => (
          <Render key={m.id} node={m} />
        ))}
    </div>
  );
}
function Survey({ node }: { node: Block }) {
  const denominator = node.config.denominator || 0;
  return (
    <div className="survey card">
      <h3>{node.label}</h3>
      {!denominator ? (
        <p>Survey results awaiting entry</p>
      ) : (
        <>
          <p>
            Valid responses: {denominator}.{" "}
            {node.config.multiselect
              ? "Multiple selections allowed; percentages may total more than 100%."
              : "Single selection."}
          </p>
          {node.children
            .filter((c) => c.kind === "option" && !c.hidden)
            .map((c) => {
              const count = c.config.count || 0;
              const percent = (count / denominator) * 100;
              return (
                <div key={c.id} className="chart-row">
                  <span>
                    {c.text}: {count} / {denominator} ({percent.toFixed(1)}%)
                  </span>
                  <div className="bar-track">
                    <div
                      style={{
                        width: `${percent}%`,
                        background: c.style.color || "var(--burgundy)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </>
      )}
      {node.children
        .filter((c) => c.kind !== "option")
        .map((c) => (
          <Render key={c.id} node={c} labelled />
        ))}
    </div>
  );
}
function ReferenceList({ refs }: { refs: Block[] }) {
  const ctx = useContext(ContentContext);
  const [category, setCategory] = useState("All sources");
  const categories = [
    "All sources",
    ...Array.from(new Set(refs.map((r) => value(r, "Source type")))).sort(
      (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
    ),
  ];
  const plain = ctx.report || ctx.editing;
  const shown = plain
    ? refs
    : refs.filter(
        (r) =>
          category === "All sources" || value(r, "Source type") === category,
      );
  return (
    <>
      {!plain && (
        <div
          className="reference-filter"
          role="group"
          aria-label="Filter references by category"
        >
          {categories.map((c) => (
            <button
              key={c}
              className={`chip ${c === category ? "selected" : ""}`}
              aria-pressed={c === category}
              onClick={() => setCategory(c)}
            >
              {c === category ? "✓ " : ""}
              {c}
            </button>
          ))}
        </div>
      )}
      {shown.map((n) => (
        <Render key={n.id} node={n} />
      ))}
      {shown.length === 0 && (
        <p className="note">No references in this category.</p>
      )}
    </>
  );
}
function Reference({ node }: { node: Block }) {
  return (
    <article className="reference">
      <h3>{node.label}</h3>
      {value(node, "Full reference override") ? (
        <p>{value(node, "Full reference override")}</p>
      ) : (
        <p>
          {value(node, "Author / organisation")}. ({value(node, "Year")}
          {value(node, "Suffix")}). <em>{value(node, "Title")}</em>.{" "}
          {value(node, "Publication / website")}.{" "}
          {value(node, "Edition") && `Edition: ${value(node, "Edition")}. `}
          {value(node, "Volume / issue / pages") &&
            `Volume / issue / pages: ${value(node, "Volume / issue / pages")}. `}
          Access date: {value(node, "Access date")}.
        </p>
      )}
      <p className="status-label">
        {value(node, "Verification status")} · {value(node, "Source type")}
      </p>
      {value(node, "URL / DOI") && safeUrl(value(node, "URL / DOI")) && (
        <a href={value(node, "URL / DOI")}>{value(node, "URL / DOI")}</a>
      )}
      {value(node, "Collection / sample details") && (
        <p>
          Collection / sample details:{" "}
          {value(node, "Collection / sample details")}
        </p>
      )}
    </article>
  );
}
function Kpi({ node }: { node: Block }) {
  return (
    <article className="kpi card">
      <p className="eyebrow">Proposed target</p>
      <h4>{node.label}</h4>
      <div className="target">
        <Rich text={value(node, "Proposed target")} />
      </div>
      <dl>
        {node.children
          .filter((c) => c.label !== "Proposed target")
          .map((c) => (
            <div key={c.id} data-node-id={c.id}>
              <dt>{c.label}</dt>
              <dd style={styles(c)}>
                <Rich
                  text={
                    c.text ||
                    (c.label === "Actual result"
                      ? "Not reported"
                      : "Not supplied")
                  }
                />
              </dd>
            </div>
          ))}
      </dl>
    </article>
  );
}
function Stage({ node }: { node: Block }) {
  const ctx = useContext(ContentContext);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ctx.report || ctx.editing || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) ctx.visit(node.id);
      },
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [node.id, ctx.report, ctx.editing, ctx.visit]);
  return (
    <div ref={ref} className="stage">
      <div className="stage-title">
        <p className="eyebrow">
          {ctx.visited.has(node.id) ? "✓ Visited" : "Journey stage"}
        </p>
        <h3>{node.label}</h3>
        <p className="note">
          {["Paid", "Earned", "Shared", "Owned"]
            .filter((p) =>
              value(node, "Touchpoints")
                .toLowerCase()
                .includes(p.toLowerCase()),
            )
            .map((p) => (
              <span
                className={`badge ${ctx.peso === p ? "selected" : ""}`}
                key={p}
              >
                {p}
                {ctx.peso === p ? " · selected" : ""}
              </span>
            ))}
        </p>
      </div>
      <div className="stage-body">
        {node.children.map((c) => (
          <Render key={c.id} node={c} labelled />
        ))}
      </div>
    </div>
  );
}
export function Render({
  node,
  labelled = false,
}: {
  node: Block;
  labelled?: boolean;
}) {
  const ctx = useContext(ContentContext);
  if (
    (node.hidden && !ctx.editing) ||
    (node.reportOnly && !ctx.report && !ctx.editing)
  )
    return null;
  let content: ReactNode;
  switch (node.kind) {
    case "paragraph":
    case "cell":
      content = <Field node={node} showLabel={labelled} />;
      break;
    case "heading":
      content = (
        <h3>
          <Rich text={node.text} />
        </h3>
      );
      break;
    case "quote":
      content = (
        <blockquote>
          <Rich text={node.text} />
          <Children node={node} />
        </blockquote>
      );
      break;
    case "image":
      content = <ImageBlock node={node} />;
      break;
    case "button":
      content = <Action node={node} />;
      break;
    case "interaction":
      content = <Interaction node={node} />;
      break;
    case "evidence":
      content = <Evidence node={node} />;
      break;
    case "timeline":
      content = <Timeline node={node} />;
      break;
    case "moment":
      content = (
        <article className="moment">
          <p className="eyebrow">{node.label}</p>
          <h4>{node.text}</h4>
          {node.children.map((c) => (
            <Render key={c.id} node={c} labelled />
          ))}
        </article>
      );
      break;
    case "stage":
      content = <Stage node={node} />;
      break;
    case "survey":
      content = <Survey node={node} />;
      break;
    case "reference":
      content = <Reference node={node} />;
      break;
    case "citation":
      content = node.config.refId ? (
        <a className="citation" href={`#${node.config.refId}`}>
          <Rich text={node.text} />
        </a>
      ) : (
        <span className="citation">
          <Rich text={node.text} />
        </span>
      );
      break;
    case "kpi":
      content = <Kpi node={node} />;
      break;
    case "scale":
      content = (
        <div className="scale">
          <h3>{node.text}</h3>
          <div
            className="scale-track"
            role="img"
            aria-label={`${node.text}. Illustrative marker ${node.config.marker} on a ${node.config.min} to ${node.config.max} range; not a research percentage.`}
          >
            <span
              style={{
                left: `${(((node.config.marker ?? 50) - (node.config.min ?? 0)) / ((node.config.max ?? 100) - (node.config.min ?? 0))) * 100}%`,
              }}
            />
          </div>
          <Children node={node} />
        </div>
      );
      break;
    case "channel":
      content = (
        <details
          className="channel card"
          open={
            ctx.report || ctx.editing || node.label === "Instagram" || undefined
          }
        >
          <summary>{node.label}</summary>
          <p>
            <Rich text={node.text} />
          </p>
          {node.children.map((c) => (
            <Render key={c.id} node={c} labelled />
          ))}
        </details>
      );
      break;
    case "peso":
      content = (
        <article
          className={`peso-card card ${ctx.peso === node.label ? "selected" : ""}`}
        >
          <p className="eyebrow">
            {ctx.peso === node.label ? "✓ Selected category" : "Media category"}
          </p>
          <h3>{node.label}</h3>
          {node.children.map((c) => (
            <Render key={c.id} node={c} labelled />
          ))}
        </article>
      );
      break;
    case "list":
      content = (
        <ul className="content-list">
          {node.children
            .filter((c) => !c.hidden || ctx.editing)
            .map((c) => (
              <li key={c.id} data-node-id={c.id} style={styles(c)}>
                <Rich text={c.text} />
              </li>
            ))}
        </ul>
      );
      break;
    case "table":
      content = (
        <div className="table-wrap">
          <table>
            <caption>{node.label}</caption>
            <tbody>
              {node.children
                .filter((c) => !c.hidden)
                .map((r) => (
                  <tr key={r.id}>
                    {r.children
                      .filter((c) => !c.hidden)
                      .map((c) => (
                        <td key={c.id} data-node-id={c.id} style={styles(c)}>
                          <Rich text={c.text} />
                        </td>
                      ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      );
      break;
    case "divider":
      content = <hr />;
      break;
    case "icon":
      content = (
        <span aria-hidden="true" style={{ opacity: node.config.opacity ?? 1 }}>
          {node.config.icon || "✦"}
        </span>
      );
      break;
    case "group":
      content =
        node.label === "Complete persona" ? (
          <Disclosure node={node} summary="View complete persona" />
        ) : (
          <div
            className={`group ${node.children.some((c) => c.kind === "kpi") ? "kpi-grid" : ""}`}
          >
            <h3>{node.label}</h3>
            {node.text && <p>{node.text}</p>}
            <Children node={node} />
          </div>
        );
      break;
    case "card":
      content = (
        <article className="card">
          <h3>{node.label}</h3>
          {node.text && (
            <p>
              <Rich text={node.text} />
            </p>
          )}
          {node.children.map((c) => (
            <Render
              key={c.id}
              node={c}
              labelled={
                node.label === "Survey record" || node.label === "Plan dates"
              }
            />
          ))}
        </article>
      );
      break;
    default:
      content = (
        <>
          <h3>{node.label}</h3>
          <Field node={node} />
        </>
      );
  }
  return (
    <div
      id={node.id}
      data-node-id={node.id}
      style={styles(node)}
      className={`editable-node kind-${node.kind} ${node.hidden ? "is-hidden" : ""} ${ctx.selected === node.id ? "is-selected" : ""}`}
    >
      {content}
    </div>
  );
}
function Hero({ node }: { node: Block }) {
  const image = node.children.find((n) => n.kind === "image")!;
  const title = node.children.find((n) => n.label === "Hero title")!;
  return (
    <section
      className="hero"
      id={node.id}
      data-node-id={node.id}
      style={styles(node)}
    >
      <div data-node-id={image.id}>
        <ImageBlock node={image} hero />
      </div>
      <div
        className="hero-overlay"
        style={{ opacity: image.config.overlay ?? 0.65 }}
      />
      <div className="hero-content">
        <div className="eyebrow">
          <Render node={child(node, "Academic label")!} />
        </div>
        <div className="concept">
          <Render node={child(node, "Concept")!} />
        </div>
        <h1 data-node-id={title.id} style={styles(title)}>
          <Rich text={title.text} />
        </h1>
        <div className="hero-subtitle">
          <Render node={child(node, "Hero subtitle")!} />
        </div>
        <Render node={child(node, "Hero introduction")!} />
        <div className="actions">
          {node.children
            .filter((n) => n.kind === "button")
            .map((n) => (
              <Render key={n.id} node={n} />
            ))}
        </div>
        <div className="disclaimer">
          <Render node={child(node, "Disclaimer")!} />
        </div>
      </div>
      <span className="hero-folio" aria-hidden="true">
        01 / 09
      </span>
    </section>
  );
}
export default function PublicSite({
  site,
  report = false,
  editing = false,
  selected,
  onSelect,
}: {
  site: Site;
  report?: boolean;
  editing?: boolean;
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const [occasion, setOccasion] = useState("");
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [peso, setPeso] = useState("All");
  const [menu, setMenu] = useState(false);
  const [active, setActive] = useState("");
  const visit = React.useCallback(
    (id: string) =>
      setVisited((old) => (old.has(id) ? old : new Set([...old, id]))),
    [],
  );
  const root = site.root;
  const sections = root.children.filter(
    (n) => n.kind === "section" && (!n.hidden || editing),
  );
  const theme = root.children.find((n) => n.kind === "theme")!;
  const meta = root.children.find((n) => n.kind === "metadata")!;
  const nav = root.children.find((n) => n.label === "Navigation")!;
  const hero = root.children.find((n) => n.kind === "hero")!;
  const occasionNode = root.children.find((n) => n.id === "occasion");
  const option = occasionNode?.children.find((n) => n.id === occasion);
  const footer = root.children.find((n) => n.kind === "footer")!;
  useEffect(() => {
    if (editing) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        }),
      { rootMargin: "-15% 0px -70% 0px" },
    );
    document
      .querySelectorAll("section.academic-section")
      .forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, [editing]);
  // Inside the editor the preview sits within the editor's own layout, so a
  // <main> here would be a second, nested main landmark. Only the real pages
  // get the landmark; the id stays either way for the skip link.
  const Main = editing ? "div" : "main";
  const themeStyle = {
    "--cream": value(theme, "Cream"),
    "--burgundy": value(theme, "Burgundy"),
    "--brown": value(theme, "Brown"),
    "--blue": value(theme, "Blue"),
    "--yellow": value(theme, "Yellow"),
    "--tan": value(theme, "Tan"),
    "--neutral": value(theme, "Neutral"),
    "--dark-cream": value(theme, "Dark cream"),
    "--dark-burgundy": value(theme, "Dark burgundy"),
    "--dark-brown": value(theme, "Dark brown"),
    "--dark-blue": value(theme, "Dark blue"),
    "--dark-yellow": value(theme, "Dark yellow"),
    "--dark-tan": value(theme, "Dark tan"),
    "--dark-neutral": value(theme, "Dark neutral"),
    "--display": value(theme, "Display font"),
    "--body": value(theme, "Body font"),
    "--page-width": value(theme, "Page width"),
    "--space": `${Number(value(theme, "Default spacing")) || 24}px`,
    "--motion": value(theme, "Animation") === "Off" ? "0ms" : "180ms",
  } as CSSProperties;
  return (
    <ContentContext.Provider
      value={{
        site,
        report,
        editing,
        occasion,
        setOccasion,
        visited,
        visit,
        peso,
        setPeso,
        selected,
        onSelect,
      }}
    >
      <div
        className={`site ${report ? "report" : ""} ${editing ? "editing-preview" : ""}`}
        style={themeStyle}
        onClickCapture={
          editing
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                const element = (e.target as HTMLElement).closest(
                  "[data-node-id]",
                );
                if (element) onSelect?.(element.getAttribute("data-node-id")!);
              }
            : undefined
        }
      >
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="site-header">
          <a className="wordmark" href={url("/")}>
            PORTER<span>A DIGITAL JOURNEY</span>
          </a>
          <div className="header-actions">
            <span className="header-note">
              An independent academic exploration
            </span>
            <a className="report-link" href={url("/report")}>
              <span className="label-full">Full academic report ↗</span>
              <span className="label-short">Report ↗</span>
            </a>
            {!editing && <ThemeToggle />}
            <button
              className="menu-toggle"
              aria-expanded={menu}
              aria-controls="section-navigation"
              onClick={() => setMenu(!menu)}
            >
              Sections {menu ? "−" : "+"}
            </button>
          </div>
        </header>
        <nav
          id="section-navigation"
          className={`section-nav ${menu ? "menu-open" : ""}`}
          aria-label="Academic sections"
        >
          {sections.map((s, i) => {
            const link = nav.children.find(
              (n) => n.config.destination === s.id,
            );
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={active === s.id ? "location" : undefined}
                onClick={() => setMenu(false)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>{" "}
                {link?.text || s.label}
              </a>
            );
          })}
          <div
            className="reading-progress"
            style={{
              width: `${(Math.max(0, sections.findIndex((s) => s.id === active) + 1) / Math.max(1, sections.length)) * 100}%`,
            }}
          />
        </nav>
        <Main id="main-content" tabIndex={-1}>
          {report ? (
            <section className="report-cover">
              <p className="eyebrow">Full academic report</p>
              <h1>{child(hero, "Hero title")?.text}</h1>
              <p>{child(hero, "Hero subtitle")?.text}</p>
              <dl className="assignment-details">
                {meta.children
                  .filter((n) => !n.label.startsWith("Site "))
                  .map((n) => (
                    <div key={n.id}>
                      <dt>{n.label}</dt>
                      <dd>{n.text}</dd>
                    </div>
                  ))}
              </dl>
              <p>{child(hero, "Disclaimer")?.text}</p>
              <button
                className="print-button"
                onClick={() => {
                  document
                    .querySelectorAll("details")
                    .forEach((d) => (d.open = true));
                  window.print();
                }}
              >
                Print / Save as PDF
              </button>
              <h2>Contents</h2>
              <ol>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.label}</a>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <>
              {!hero.hidden && <Hero node={hero} />}
              <div className="occasion-wrap">
                {occasionNode && <Render node={occasionNode} />}
              </div>
            </>
          )}
          {sections.map((s, i) => (
            <section
              id={s.id}
              data-node-id={s.id}
              style={styles(s)}
              className={`academic-section section-${s.id}`}
              key={s.id}
            >
              <div className="section-heading">
                <span className="section-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="eyebrow">
                    {
                      [
                        "The brand",
                        "The evidence",
                        "The customer",
                        "The person",
                        "The experience",
                        "The ecosystem",
                        "The reasoning",
                        "The plan",
                        "The sources",
                      ][i]
                    }
                  </p>
                  <h2>{s.text}</h2>
                </div>
              </div>
              {s.id === "journey" && (
                <>
                  <p className="occasion-badge">
                    Occasion: {option?.text || "Choose your own route"}
                  </p>
                  {option && (
                    <p className="occasion-example">
                      {value(option, "Feedback")}
                    </p>
                  )}
                  <div className="journey-overview">
                    {s.children
                      .filter((n) => n.kind === "stage")
                      .map((n) => (
                        <a
                          key={n.id}
                          href={`#${n.id}`}
                          onClick={() => visit(n.id)}
                        >
                          {visited.has(n.id) ? "✓ " : ""}
                          {n.label}
                        </a>
                      ))}
                  </div>
                  <p aria-live="polite">{visited.size} of 5 stages visited</p>
                </>
              )}
              {s.id === "peso" && !report && (
                <div className="choice-row">
                  {["All", "Paid", "Earned", "Shared", "Owned"].map((p) => (
                    <button
                      key={p}
                      aria-pressed={peso === p}
                      onClick={() => setPeso(p)}
                    >
                      {peso === p ? "✓ " : ""}
                      {p === "All" ? "Show the Complete Ecosystem" : p}
                    </button>
                  ))}
                  <p role="status">
                    {peso === "All"
                      ? "All journey touchpoints shown."
                      : `${peso} touchpoints highlighted in the journey above.`}
                  </p>
                </div>
              )}
              {s.id === "channels" && !report && (
                <div className="actions">
                  <button
                    onClick={() =>
                      document
                        .querySelectorAll(".channel")
                        .forEach((n) => ((n as HTMLDetailsElement).open = true))
                    }
                  >
                    Expand all
                  </button>
                  <button
                    onClick={() =>
                      document
                        .querySelectorAll(".channel")
                        .forEach(
                          (n) => ((n as HTMLDetailsElement).open = false),
                        )
                    }
                  >
                    Collapse all
                  </button>
                </div>
              )}
              <div className="section-content">
                {s.id === "references" ? (
                  <>
                    {s.children
                      .filter(
                        (n) =>
                          n.kind !== "reference" && n.label !== "AI disclosure",
                      )
                      .map((n) => (
                        <Render key={n.id} node={n} />
                      ))}
                    <ReferenceList
                      refs={s.children
                        .filter((n) => n.kind === "reference")
                        .sort((a, b) =>
                          (value(a, "Author / organisation") === "Not supplied"
                            ? a.label
                            : value(a, "Author / organisation")
                          ).localeCompare(
                            value(b, "Author / organisation") === "Not supplied"
                              ? b.label
                              : value(b, "Author / organisation"),
                          ),
                        )}
                    />
                    {s.children
                      .filter((n) => n.label === "AI disclosure")
                      .map((n) => (
                        <Render key={n.id} node={n} />
                      ))}
                  </>
                ) : (
                  s.children.map((n) => <Render key={n.id} node={n} />)
                )}
              </div>
            </section>
          ))}
          {!report && (
            <section className="completion">
              <p className="eyebrow">A considered way forward</p>
              <h2>
                {visited.size === 5
                  ? value(
                      root.children.find((n) => n.id === "summary")!,
                      "Completed title",
                    )
                  : root.children.find((n) => n.id === "summary")?.text}
              </h2>
              <p>{visited.size} of 5 stages visited</p>
              <Render
                node={child(
                  root.children.find((n) => n.id === "summary")!,
                  "Summary",
                )!}
              />
              <Render
                node={child(
                  root.children.find((n) => n.id === "summary")!,
                  "Recommendation",
                )!}
              />
            </section>
          )}
        </Main>
        <footer data-node-id={footer.id} className="site-footer">
          <div className="wordmark">PORTER</div>
          <Render node={footer} />
          <a href="#main-content">Return to top ↑</a>
        </footer>
        {!editing && <ScrollToTop />}
      </div>
    </ContentContext.Provider>
  );
}
