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

  // ── Score Filtering Logic ────────────────────────────────────────

  let activeScoreFilter = null;
  const ROW_SELECTORS = ".list-table-data .list-table-row, .list-table-data, table.list-table tbody tr, #list-container .list-item";

  function getRowScore(row) {
    // Attempt to extract the text score
    const scoreElem = row.querySelector(".data.score, td.score, .score-label, .score .link");
    if (!scoreElem) return 0;
    
    const text = (scoreElem.innerText || scoreElem.textContent || "").trim();
    if (text === "-" || text === "N/A" || text === "") return 0;
    
    const parsed = parseInt(text, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function applyFilterToRow(row) {
    if (activeScoreFilter === null) {
      row.style.display = "";
      return;
    }
    
    const score = getRowScore(row);
    row.style.display = (score === activeScoreFilter) ? "" : "none";
  }

  function applyFilterToAll() {
    const rows = document.querySelectorAll(ROW_SELECTORS);
    let visibleCount = 0;
    rows.forEach(row => {
      applyFilterToRow(row);
      // Update numbering for visible rows sequentially
      if (row.style.display !== "none") {
        visibleCount++;
        const numberCell = row.querySelector(".data.number, td.number, .number, .list-table-data .data.number");
        if (numberCell) {
          numberCell.textContent = visibleCount;
        }
      }
    });
  }

  // Listen for popup messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "filterScore") {
      activeScoreFilter = request.score; // Integer or null
      applyFilterToAll();
      sendResponse({ status: "ok" });
    }
  });

  // Observe dynamically loaded rows (infinite scroll)
  const observer = new MutationObserver((mutations) => {
    if (activeScoreFilter === null) return;
    
    // Re-apply filter if structural changes occur on the list
    let shouldUpdate = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldUpdate = true;
        break;
      }
    }
    if (shouldUpdate) {
      applyFilterToAll();
    }
  });
  
  // Attach observer to a robust parent
  const listContainer = document.querySelector("#list-container, .list-block") || document.body;
  if (listContainer) {
    observer.observe(listContainer, { childList: true, subtree: true });
  }

})();
