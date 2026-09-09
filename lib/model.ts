export const kinds = [
  "site",
  "section",
  "hero",
  "group",
  "card",
  "heading",
  "paragraph",
  "list",
  "quote",
  "table",
  "row",
  "cell",
  "image",
  "button",
  "divider",
  "evidence",
  "reference",
  "citation",
  "kpi",
  "interaction",
  "option",
  "timeline",
  "moment",
  "stage",
  "peso",
  "channel",
  "survey",
  "scale",
  "icon",
  "footer",
  "metadata",
  "theme",
] as const;
export type Kind = (typeof kinds)[number];
export type Style = {
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  margin?: number;
  width?: string;
  maxWidth?: string;
  textAlign?: "left" | "center" | "right";
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  columns?: number;
  mobileFontSize?: number;
  mobilePadding?: number;
};
export type Config = {
  src?: string;
  alt?: string;
  caption?: string;
  credit?: string;
  source?: string;
  fit?: "cover" | "contain";
  aspectRatio?: string;
  height?: number;
  position?: string;
  overlay?: number;
  href?: string;
  target?: "_self" | "_blank";
  action?: "url" | "section" | "report" | "reveal";
  destination?: string;
  refId?: string;
  count?: number;
  denominator?: number;
  multiselect?: boolean;
  min?: number;
  max?: number;
  marker?: number;
  defaultId?: string;
  icon?: string;
  opacity?: number;
  animation?: boolean;
};
export type Block = {
  id: string;
  kind: Kind;
  label: string;
  text: string;
  hidden: boolean;
  reportOnly: boolean;
  style: Style;
  config: Config;
  children: Block[];
};
export type Site = { schemaVersion: 1; root: Block };
export function safeUrl(value: string) {
  return (
    value === "" ||
    /^\/(?!\/)[a-zA-Z0-9/_ .-]*$/.test(value) ||
    /^#[a-zA-Z0-9._-]+$/.test(value) ||
    /^https?:\/\/[^\s<>"\\]+$/i.test(value)
  );
}

export function flatten(root: Block): Block[] {
  return [root, ...root.children.flatMap(flatten)];
}
export function find(root: Block, id: string): Block | undefined {
  return flatten(root).find((n) => n.id === id);
}
export function child(n: Block, label: string) {
  return n.children.find((c) => c.label === label);
}
export function value(n: Block, label: string) {
  return child(n, label)?.text || "";
}
export function duplicate(n: Block): Block {
  const copy = structuredClone(n);
  const ids = new Map<string, string>();
  flatten(copy).forEach((b) => {
    const old = b.id;
    b.id = crypto.randomUUID();
    ids.set(old, b.id);
  });
  flatten(copy).forEach((b) => {
    for (const key of ["refId", "destination", "defaultId"] as const) {
      const v = b.config[key];
      if (v && ids.has(v)) b.config[key] = ids.get(v);
    }
  });
  return copy;
}
export function editById(
  site: Site,
  id: string,
  fn: (node: Block) => void,
): Site {
  const next = structuredClone(site);
  const n = find(next.root, id);
  if (!n) throw Error("Block not found");
  fn(n);
  return next;
}
export function checklist(site: Site) {
  const nodes = flatten(site.root);
  const refs = nodes.filter((n) => n.kind === "reference");
  const issues: { id: string; message: string }[] = [];
  for (const n of nodes) {
    if (
      /not supplied|evidence required|not documented|not established|awaiting entry|incomplete|not confirmed/i.test(
        n.text,
      )
    )
      issues.push({ id: n.id, message: `${n.label}: ${n.text.slice(0, 110)}` });
    if (n.kind === "image" && n.config.src === "/placeholder.svg")
      issues.push({ id: n.id, message: `${n.label}: photograph not supplied` });
    if (
      n.kind === "citation" &&
      n.config.refId &&
      !refs.some((r) => r.id === n.config.refId)
    )
      issues.push({
        id: n.id,
        message: "Citation points to a missing reference",
      });
    if (n.kind === "citation" && n.config.refId) {
      const ref = refs.find((r) => r.id === n.config.refId);
      const year = ref && value(ref, "Year");
      if (year && /\d{4}/.test(year) && !n.text.includes(year))
        issues.push({
          id: n.id,
          message: "Check citation year / suffix against reference",
        });
    }
  }
  for (const r of refs)
    if (!nodes.some((n) => n.config.refId === r.id))
      issues.push({ id: r.id, message: `Unused reference: ${r.label}` });
  return issues;
}
