import { z } from "zod";

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
const colour = z.string().regex(/^#[0-9a-f]{6}$/i);
const dimension = z.string().regex(/^(auto|[0-9.]+(px|%|rem|vw))$/);
const styleSchema = z
  .object({
    color: colour.optional(),
    backgroundColor: colour.optional(),
    borderColor: colour.optional(),
    borderWidth: z.number().min(0).max(20).optional(),
    borderRadius: z.number().min(0).max(200).optional(),
    padding: z.number().min(0).max(150).optional(),
    margin: z.number().min(0).max(150).optional(),
    width: dimension.optional(),
    maxWidth: dimension.optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    fontFamily: z
      .enum([
        "Georgia, serif",
        "Arial, sans-serif",
        "Verdana, sans-serif",
        "Times New Roman, serif",
      ])
      .optional(),
    fontSize: z.number().min(12).max(120).optional(),
    fontWeight: z.number().min(100).max(900).optional(),
    lineHeight: z.number().min(1).max(3).optional(),
    letterSpacing: z.number().min(-3).max(12).optional(),
    columns: z.number().int().min(1).max(4).optional(),
    mobileFontSize: z.number().min(12).max(64).optional(),
    mobilePadding: z.number().min(0).max(64).optional(),
  })
  .strict();
export function safeUrl(value: string) {
  return (
    value === "" ||
    /^\/(?!\/)[a-zA-Z0-9/_ .-]*$/.test(value) ||
    /^#[a-zA-Z0-9._-]+$/.test(value) ||
    /^https?:\/\/[^\s<>"\\]+$/i.test(value)
  );
}
const url = z
  .string()
  .max(3000)
  .refine(safeUrl, "Use an http(s) URL, local path or stable anchor.");
const configSchema = z
  .object({
    src: url.optional(),
    alt: z.string().max(2000).optional(),
    caption: z.string().max(5000).optional(),
    credit: z.string().max(2000).optional(),
    source: url.optional(),
    fit: z.enum(["cover", "contain"]).optional(),
    aspectRatio: z
      .string()
      .regex(/^\d+(\s*\/\s*\d+)?$/)
      .optional(),
    height: z.number().min(0).max(1500).optional(),
    position: z
      .string()
      .regex(/^\d{1,3}% \d{1,3}%$/)
      .optional(),
    overlay: z.number().min(0).max(1).optional(),
    href: url.optional(),
    target: z.enum(["_self", "_blank"]).optional(),
    action: z.enum(["url", "section", "report", "reveal"]).optional(),
    destination: z.string().max(200).optional(),
    refId: z.string().max(200).optional(),
    count: z.number().int().min(0).max(10000000).optional(),
    denominator: z.number().int().min(0).max(10000000).optional(),
    multiselect: z.boolean().optional(),
    min: z.number().min(-10000).max(10000).optional(),
    max: z.number().min(-10000).max(10000).optional(),
    marker: z.number().min(-10000).max(10000).optional(),
    defaultId: z.string().optional(),
    icon: z.enum(["✦", "○", "◇", "+", "→"]).optional(),
    opacity: z.number().min(0).max(1).optional(),
    animation: z.boolean().optional(),
  })
  .strict();
const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z
    .object({
      id: z
        .string()
        .regex(/^[a-zA-Z0-9._-]+$/)
        .max(200),
      kind: z.enum(kinds),
      label: z.string().max(500),
      text: z.string().max(50000),
      hidden: z.boolean(),
      reportOnly: z.boolean(),
      style: styleSchema,
      config: configSchema,
      children: z.array(blockSchema).max(500),
    })
    .strict(),
);
export const siteSchema = z
  .object({ schemaVersion: z.literal(1), root: blockSchema })
  .strict()
  .superRefine((site, ctx) => {
    const ids = new Set<string>();
    let total = 0;
    function walk(n: Block, depth: number) {
      total++;
      if (depth > 16 || total > 10000)
        ctx.addIssue({
          code: "custom",
          message: "Content tree is too large or deep.",
        });
      if (ids.has(n.id))
        ctx.addIssue({ code: "custom", message: `Duplicate ID: ${n.id}` });
      ids.add(n.id);
      if (n.kind === "survey") {
        const d = n.config.denominator || 0;
        const counts = n.children
          .filter((c) => c.kind === "option")
          .map((c) => c.config.count || 0);
        if (
          counts.some((c) => c > d) ||
          (!n.config.multiselect && counts.reduce((a, b) => a + b, 0) > d)
        )
          ctx.addIssue({
            code: "custom",
            message: `Invalid survey counts: ${n.label}`,
          });
      }
      if (
        n.kind === "scale" &&
        ((n.config.max ?? 100) <= (n.config.min ?? 0) ||
          (n.config.marker ?? 50) < (n.config.min ?? 0) ||
          (n.config.marker ?? 50) > (n.config.max ?? 100))
      )
        ctx.addIssue({ code: "custom", message: `Invalid scale: ${n.label}` });
      if (depth <= 16) n.children.forEach((c) => walk(c, depth + 1));
    }
    walk(site.root, 0);
    if (site.root.kind !== "site")
      ctx.addIssue({ code: "custom", message: "Root must be a site." });
    for (const kind of ["theme", "metadata", "hero", "footer"])
      if (site.root.children.filter((n) => n.kind === kind).length !== 1)
        ctx.addIssue({
          code: "custom",
          message: `Exactly one ${kind} record is required.`,
        });
    for (const label of ["Navigation", "Journey summary"])
      if (!site.root.children.some((n) => n.label === label))
        ctx.addIssue({
          code: "custom",
          message: `Required shell record missing: ${label}`,
        });
    const theme = site.root.children.find((n) => n.kind === "theme");
    if (theme)
      for (const field of theme.children) {
        if (
          [
            "Cream",
            "Burgundy",
            "Brown",
            "Blue",
            "Yellow",
            "Tan",
            "Neutral",
          ].includes(field.label) &&
          !/^#[0-9a-f]{6}$/i.test(field.text)
        )
          ctx.addIssue({
            code: "custom",
            message: `Invalid global colour: ${field.label}`,
          });
        if (field.label === "Page width" && !/^\d+(px|rem)$/.test(field.text))
          ctx.addIssue({
            code: "custom",
            message: "Page width needs px or rem.",
          });
        if (
          field.label === "Default spacing" &&
          (!/^\d+$/.test(field.text) || Number(field.text) > 100)
        )
          ctx.addIssue({
            code: "custom",
            message: "Global spacing must be 0 to 100 pixels.",
          });
      }
  });
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
