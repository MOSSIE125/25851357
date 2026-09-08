import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Porter | Mia’s Digital World",
  description:
    "An independent digital marketing assignment exploring Porter’s proposed customer journey.",
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3eb" },
    { media: "(prefers-color-scheme: dark)", color: "#17130f" },
  ],
};
// Runs before first paint so a stored dark preference never flashes light.
// Keep in sync with the toggle in components/ThemeToggle.tsx.
const applyStoredTheme = `try{var t=localStorage.getItem("porter-theme");document.documentElement.dataset.theme=t==="dark"||t==="light"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){document.documentElement.dataset.theme="light"}`;
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script and browser extensions such as Dark Reader both write to
    // <html> before React hydrates; neither is a real server/client mismatch.
    <html lang="en-ZA" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyStoredTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
