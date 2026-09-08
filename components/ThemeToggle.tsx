"use client";
// The current theme lives on <html data-theme>, written before first paint by
// the inline script in app/layout.tsx. This button reads and writes that
// attribute directly rather than holding React state, so there is nothing to
// hydrate and no flash of the wrong label on load. CSS shows whichever of the
// two labels matches the active theme.
export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("porter-theme", next);
    } catch {
      // Private browsing can refuse storage; the choice still applies for now.
    }
  }
  return (
    <button type="button" className="theme-toggle" onClick={toggle}>
      <span className="when-light">
        <span aria-hidden="true">☾</span> Dark
        <span className="label-tail"> theme</span>
      </span>
      <span className="when-dark">
        <span aria-hidden="true">☀</span> Light
        <span className="label-tail"> theme</span>
      </span>
    </button>
  );
}
