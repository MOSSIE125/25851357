"use client";
import { useEffect, useState } from "react";
// Appears once the reader is well past the hero. Focus moves to <main> so a
// keyboard or screen-reader user actually lands at the top rather than keeping
// focus on a button that has scrolled away.
export default function ScrollToTop() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const update = () => setShown(window.scrollY > 700);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <button
      type="button"
      className="scroll-top"
      hidden={!shown}
      onClick={() => {
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
        document.getElementById("main-content")?.focus();
      }}
    >
      <span aria-hidden="true">↑</span> Back to top
    </button>
  );
}
