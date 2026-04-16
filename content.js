/* ── MAL Gap Detector – Floating Scroll Buttons ─────────────────────
   Injected automatically on myanimelist.net pages via content_scripts.
   Creates two circular floating buttons (↑ and ↓) in the bottom-right
   corner for quick page navigation.
──────────────────────────────────────────────────────────────────── */

(function () {
  // Guard against double-injection
  if (document.getElementById("mal-gap-scroll-btns")) return;

  const container = document.createElement("div");
  container.id = "mal-gap-scroll-btns";

  // ── Up Button ──────────────────────────────────────────────────
  const upBtn = document.createElement("button");
  upBtn.id = "mal-gap-scroll-up";
  upBtn.setAttribute("aria-label", "Scroll to top");
  upBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;

  // ── Down Button ────────────────────────────────────────────────
  const downBtn = document.createElement("button");
  downBtn.id = "mal-gap-scroll-down";
  downBtn.setAttribute("aria-label", "Scroll to bottom");
  downBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  container.appendChild(upBtn);
  container.appendChild(downBtn);
  document.body.appendChild(container);

  // ── Scroll Actions ─────────────────────────────────────────────
  upBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  downBtn.addEventListener("click", () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  });

  // ── Show / Hide based on scroll position ───────────────────────
  function updateVisibility() {
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    upBtn.classList.toggle("mal-gap-btn-hidden", scrollY < 100);
    downBtn.classList.toggle("mal-gap-btn-hidden", maxScroll - scrollY < 100);
  }

  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();
})();
