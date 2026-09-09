// The Zod validation schema, kept out of lib/model.ts on purpose.
//
// PublicSite is a client component and imports a few helpers from lib/model.
// While the schema lived there, every reader downloaded Zod and its polyfills
// with the page even though the public site never validates anything. Only the
// server and the tooling need this file.
import { z } from "zod";
import { type Block, kinds, safeUrl } from "./model";

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
