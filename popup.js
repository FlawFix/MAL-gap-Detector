// ── Date Parsing ────────────────────────────────────────────────────
// MAL renders dates in several formats depending on user settings and
// list layout.  We try the most common ones before falling back to the
// native Date parser.

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === "-" || dateStr.trim() === "") return null;
  const s = dateStr.trim();

  // Format 1: "DD-MM-YY" (legacy/classic list)
  const ddmmyy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (ddmmyy) {
    const [, day, month, year] = ddmmyy;
    // Use a pivot: 00-49 → 2000-2049, 50-99 → 1950-1999
    const y = parseInt(year, 10);
    const fullYear = y < 50 ? 2000 + y : 1900 + y;
    return new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10));
  }

  // Format 2: "Mon D, YYYY" or "MMM DD, YYYY" (modern list, e.g. "Apr 3, 2024")
  const mdyLong = Date.parse(s);
  if (!isNaN(mdyLong)) return new Date(mdyLong);

  return null;
}

function formatDate(date) {
  if (!date) return "N/A";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

// ── Gap Detection ───────────────────────────────────────────────────

function detectGaps(data) {
  const withDates = data
    .map(item => ({
      ...item,
      startedDate: parseDate(item.started),
      finishedDate: parseDate(item.finished)
    }))
    .filter(item => item.finishedDate !== null);  // safety: drop unparseable

  const sorted = withDates.sort((a, b) => a.finishedDate - b.finishedDate);
  const results = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    let gapDays = 0;
    if (next.startedDate && current.finishedDate) {
      gapDays = Math.round(
        (next.startedDate - current.finishedDate) / (1000 * 60 * 60 * 24)
      ) - 1;
    }

    results.push({
      current,
      next,
      gap: Math.max(gapDays, 0)
    });
  }

  return results;
}

// ── Markdown Generation ─────────────────────────────────────────────

function generateMarkdown(gaps) {
  let md = "# Anime Watch Gap Report\n\n";

  gaps.forEach(entry => {
    const { current, next, gap } = entry;
    md += `##### ${current.title} → ${next.title}\n`;
    md += `- Finished: ${formatDate(current.finishedDate)}\n`;
    md += `- Next Started: ${formatDate(next.startedDate)}\n`;
    md += `- **Gap: ${gap} day${gap !== 1 ? 's' : ''}**\n`;
    md += "\n";
  });

  return md;
}

// ── UI Helpers ──────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const analyzeBtn = $("#analyze");
const downloadBtn = $("#download");
const statusEl = $("#status");
const outputEl = $("#output");
const summaryEl = $("#summary");
const minGapInput = $("#minGap");
const sortSelect = $("#sortBy");

let rawGaps = [];       // unfiltered results from the last analysis
let currentReport = ""; // generated markdown

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = type; // "error" | "info" | "success"
}

function clearStatus() {
  statusEl.className = "hidden";
  statusEl.textContent = "";
}

function setLoading(loading) {
  const spinner = analyzeBtn.querySelector(".spinner");
  const text = analyzeBtn.querySelector(".btn-text");
  if (loading) {
    spinner.classList.remove("hidden");
    text.textContent = "Analyzing…";
    analyzeBtn.disabled = true;
  } else {
    spinner.classList.add("hidden");
    text.textContent = "Analyze";
    analyzeBtn.disabled = false;
  }
}

function showSummary(gaps) {
  if (gaps.length === 0) {
    summaryEl.classList.add("hidden");
    return;
  }
  const gapValues = gaps.map(g => g.gap);
  const largest = Math.max(...gapValues);
  const avg = (gapValues.reduce((a, b) => a + b, 0) / gapValues.length).toFixed(1);

  $("#totalEntries").innerHTML = `<strong>${gaps.length}</strong> transitions`;
  $("#largestGap").innerHTML = `<strong>${largest}</strong> day max`;
  $("#avgGap").innerHTML = `<strong>${avg}</strong> day avg`;
  summaryEl.classList.remove("hidden");
}

function applyFiltersAndRender() {
  const minGap = Math.max(parseInt(minGapInput.value, 10) || 0, 1);
  const sortBy = sortSelect.value;

  // Always exclude 0-gap entries (no real gap) + apply user threshold
  let filtered = rawGaps.filter(g => g.gap >= minGap);

  if (sortBy === "gap-desc") {
    filtered.sort((a, b) => b.gap - a.gap);
  } else if (sortBy === "gap-asc") {
    filtered.sort((a, b) => a.gap - b.gap);
  }
  // "chronological" keeps the default order from detectGaps()

  showSummary(filtered);
  currentReport = generateMarkdown(filtered);
  outputEl.textContent = currentReport;
  downloadBtn.disabled = filtered.length === 0;
}

// ── Scraping (injected into the MAL tab) ────────────────────────────
// This function runs inside the MAL page context.  It tries selectors
// for both the modern and classic list layouts.

function scrapeAnimelist() {
  const data = [];

  // Modern layout
  const modernRows = document.querySelectorAll(".list-table-data .list-table-row, .list-table-data");
  modernRows.forEach(row => {
    const titleEl = row.querySelector(".title .link, .title a");
    const startedEl = row.querySelector(".data.started, td.started");
    const finishedEl = row.querySelector(".data.finished, td.finished");

    const title = titleEl?.innerText?.trim();
    const started = startedEl?.innerText?.trim();
    const finished = finishedEl?.innerText?.trim();

    if (title && finished && finished !== "-") {
      data.push({ title, started, finished });
    }
  });

  // Classic layout fallback (table rows)
  if (data.length === 0) {
    const classicRows = document.querySelectorAll("table.list-table tbody tr, #list-container .list-item");
    classicRows.forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 8) {
        const title = cols[1]?.innerText?.trim();
        const started = cols[6]?.innerText?.trim();
        const finished = cols[7]?.innerText?.trim();
        if (title && finished && finished !== "-") {
          data.push({ title, started, finished });
        }
      }
    });
  }

  return data;
}

// ── Main: Analyze Button ────────────────────────────────────────────

analyzeBtn.addEventListener("click", async () => {
  clearStatus();
  outputEl.textContent = "";
  summaryEl.classList.add("hidden");
  downloadBtn.disabled = true;

  // Validate active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || !tab.url.startsWith("https://myanimelist.net/animelist/")) {
    setStatus("Navigate to a MAL anime list page first (myanimelist.net/animelist/…)", "error");
    return;
  }

  setLoading(true);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeAnimelist
    });

    const data = results?.[0]?.result;

    if (!data || data.length === 0) {
      setStatus("No completed anime found on this page. Make sure the list has finished dates visible.", "error");
      setLoading(false);
      return;
    }

    rawGaps = detectGaps(data);
    setStatus(`Scraped ${data.length} entries, found ${rawGaps.length} transitions.`, "success");
    applyFiltersAndRender();
  } catch (err) {
    console.error("MAL Gap Detector error:", err);
    setStatus(`Error: ${err.message}`, "error");
  } finally {
    setLoading(false);
  }
});

// ── Filters: re-render on change ────────────────────────────────────

minGapInput.addEventListener("input", () => {
  if (rawGaps.length > 0) applyFiltersAndRender();
});

sortSelect.addEventListener("change", () => {
  if (rawGaps.length > 0) applyFiltersAndRender();
});

// ── Download Button ─────────────────────────────────────────────────

downloadBtn.addEventListener("click", () => {
  if (!currentReport) return;

  const blob = new Blob([currentReport], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "mal-gap-report.md";
  a.click();

  // Clean up blob reference to avoid memory leak
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});