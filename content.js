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

  function getMovableNode(row) {
    const tbody = row.closest("tbody");
    if (tbody && tbody.parentNode && tbody.parentNode.tagName === "TABLE") {
      if (tbody.classList.contains("list-item")) return tbody;
    }
    return row;
  }

  function getValidRows() {
    const rawRows = Array.from(document.querySelectorAll(ROW_SELECTORS));
    const validMovableNodes = [];
    const seen = new Set();
    
    for (const row of rawRows) {
      if (row.classList.contains("list-table-header") || 
          row.classList.contains("table-header") || 
          row.classList.contains("more-info") ||
          row.closest(".more-info") ||
          row.id.startsWith("more-") ||
          row.querySelector("th") || 
          row.tagName === "TH") {
        continue;
      }
      const movable = getMovableNode(row);
      if (!seen.has(movable)) {
        seen.add(movable);
        validMovableNodes.push(movable);
      }
    }
    return validMovableNodes;
  }

  function getRowScore(row) {
    // Attempt to extract the text score
    const scoreElem = row.querySelector(".data.score, td.score, .score-label, .score .link");
    if (!scoreElem) return 0;
    
    const text = (scoreElem.textContent || "").trim();
    if (text === "-" || text === "N/A" || text === "") return 0;
    
    const parsed = parseInt(text, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  let isUpdating = false;

  function applyFilterToAll() {
    if (isUpdating) return;
    isUpdating = true;
    try {
      const rows = getValidRows();
      
      // Phase 1: Read all scores (prevent layout thrashing)
      const rowsData = rows.map(row => ({
        row,
        score: getRowScore(row)
      }));

      // Phase 2: Write all styles and update counters
      let visibleCount = 0;
      rowsData.forEach(({ row, score }) => {
        const isVisible = activeScoreFilter === null || score === activeScoreFilter;
        row.style.display = isVisible ? "" : "none";
        
        // Update numbering for visible rows sequentially
        if (isVisible) {
          visibleCount++;
          const numberCell = row.querySelector(".data.number, td.number, .number, .list-table-data .data.number");
          if (numberCell && numberCell.textContent != visibleCount) {
            numberCell.textContent = visibleCount;
          }
        }
      });
    } finally {
      setTimeout(() => { isUpdating = false; }, 0);
    }
  }

  // ── Days Sorting Logic ──────────────────────────────────────────

  function parseDateSnippet(dateStr) {
    if (!dateStr || dateStr === "-" || dateStr === "N/A" || dateStr === "") return null;
    const value = dateStr.trim();
    const legacyMatch = value.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
    if (legacyMatch) {
      const [, day, month, year] = legacyMatch;
      const shortYear = parseInt(year, 10);
      const fullYear = shortYear < 50 ? 2000 + shortYear : 1900 + shortYear;
      return new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10));
    }
    const parsedValue = Date.parse(value);
    return Number.isNaN(parsedValue) ? null : new Date(parsedValue);
  }

  function getRowDaysToComplete(row) {
    const startedElem = row.querySelector(".data.started, td.started");
    const finishedElem = row.querySelector(".data.finished, td.finished");
    if (!startedElem || !finishedElem) return -1;

    const start = parseDateSnippet(startedElem.textContent);
    const finish = parseDateSnippet(finishedElem.textContent);
    if (!start || !finish) return -1;

    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    return Math.max(Math.round((finish - start) / MS_PER_DAY), 0);
  }

  let originalOrderArray = [];

  function applySortDays(order) {
    const rows = getValidRows();
    
    const sortable = rows.map(row => ({
      movable: row,
      days: getRowDaysToComplete(row)
    }));

    if (originalOrderArray.length === 0 && sortable.length > 0) {
      originalOrderArray = sortable.map(item => item.movable);
    }

    if (order === null) {
      originalOrderArray.forEach(movable => {
        if (movable.parentNode) movable.parentNode.appendChild(movable);
      });
      applyFilterToAll();
      return;
    }

    sortable.sort((a, b) => {
      if (a.days === -1 && b.days === -1) return 0;
      if (a.days === -1) return 1;
      if (b.days === -1) return -1;
      return order === "desc" ? b.days - a.days : a.days - b.days;
    });

    sortable.forEach(item => {
       const parent = item.movable.parentNode;
       if (parent) parent.appendChild(item.movable);
    });

    applyFilterToAll(); // re-evaluates indices
  }

  // Listen for popup messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "filterScore") {
      activeScoreFilter = request.score; // Integer or null
      applyFilterToAll();
      sendResponse({ status: "ok" });
    } else if (request.action === "sortDays") {
      applySortDays(request.order);
      sendResponse({ status: "ok" });
    }
  });

  // Observe dynamically loaded rows (infinite scroll)
  const observer = new MutationObserver((mutations) => {
    if (activeScoreFilter === null || isUpdating) return;
    
    // Re-apply filter if structural changes occur on the list
    let shouldUpdate = false;
    for (const mutation of mutations) {
      // Only care about actual elements, to ignore text node changes
      const hasAddedElements = Array.from(mutation.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE);
      if (hasAddedElements) {
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
