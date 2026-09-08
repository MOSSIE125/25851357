// GitHub Pages serves a project site from a sub-path (https://user.github.io/25851357),
// so every same-origin URL the app writes by hand has to carry that prefix. Next
// prefixes its own asset pipeline automatically, but not plain <a href> or an
// <img src> that came from owner-edited content, which is what this is for.
// NEXT_PUBLIC_BASE_PATH is inlined at build time and is empty for the normal
// server build, where url() is the identity function.
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export function url(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return basePath + path;
}
