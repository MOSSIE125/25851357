const development = process.env.NODE_ENV !== "production";
// React and Turbopack HMR need eval() and a websocket in development only.
// Production keeps the strict policy: no unsafe-eval, no websocket origins.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: http:",
  "font-src 'self'",
  `connect-src 'self'${development ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");
// `npm run export` sets STATIC_EXPORT to produce the GitHub Pages build: plain
// files, no server, sub-path aware. The normal server build is untouched.
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const config = {
  ...(staticExport
    ? {
        output: "export",
        distDir: ".next-static",
        trailingSlash: true,
        images: { unoptimized: true },
        basePath,
        assetPrefix: basePath || undefined,
      }
    : {}),
  poweredByHeader: false,
  async headers() {
    if (staticExport) return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};
export default config;
