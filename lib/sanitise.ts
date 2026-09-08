import sanitizeHtml from "sanitize-html";
import { flatten, siteSchema, type Site } from "./model";
export function cleanRich(text: string) {
  return sanitizeHtml(text, {
    allowedTags: ["b", "strong", "i", "em", "u", "a", "span", "br"],
    allowedAttributes: { a: ["href", "target", "rel"], span: ["style"] },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    allowedStyles: { span: { color: [/^#[0-9a-f]{6}$/i] } },
    transformTags: {
      a: (_tag, attrs) => ({
        tagName: "a",
        attribs: { ...attrs, rel: "noopener noreferrer" },
      }),
    },
  });
}
export function validateSite(input: unknown): Site {
  const site = siteSchema.parse(input);
  for (const n of flatten(site.root)) n.text = cleanRich(n.text);
  return site;
}
