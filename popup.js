// ── Shared Constants ────────────────────────────────────────────────
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MAL_ANIMELIST_URL_PREFIX = "https://myanimelist.net/animelist/";
const REPORT_FILENAME = "mal-gap-report.md";
const RATING_INPUT_IDS = ["rStory", "rCharacter", "rAnimation", "rSound", "rEnjoyment"];

// ── Date Parsing & Formatting ───────────────────────────────────────

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === "-" || dateStr.trim() === "") {
    return null;
  }

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

function formatDate(date) {
  if (!date) {
    return "N/A";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function calculateGapDays(previousFinishedDate, nextStartedDate) {
  if (!previousFinishedDate || !nextStartedDate) {
    return 0;
  }

  return Math.max(Math.round((nextStartedDate - previousFinishedDate) / MS_PER_DAY) - 1, 0);
}

// ── Gap Detection ───────────────────────────────────────────────────

function detectGaps(data) {
  const sortedEntries = data
    .map((item) => ({
      ...item,
      startedDate: parseDate(item.started),
      finishedDate: parseDate(item.finished)
    }))
    .filter((item) => item.finishedDate !== null)
    .sort((a, b) => a.finishedDate - b.finishedDate);

  return sortedEntries.slice(0, -1).map((current, index) => {
    const next = sortedEntries[index + 1];

    return {
      current,
      next,
      gap: calculateGapDays(current.finishedDate, next.startedDate)
    };
  });
}

// ── Markdown Generation ─────────────────────────────────────────────

function generateMarkdown(gaps) {
  const lines = ["# Anime Watch Gap Report", ""];

  gaps.forEach(({ current, next, gap }) => {
    lines.push(`##### ${current.title} → ${next.title}`);
    lines.push(`- Finished: ${formatDate(current.finishedDate)}`);
    lines.push(`- Next Started: ${formatDate(next.startedDate)}`);
    lines.push(`- **Gap: ${gap} day${gap !== 1 ? "s" : ""}**`);
    lines.push("");
  });

  return lines.join("\n");
}

// ── MAL Page Scraping ───────────────────────────────────────────────

function scrapeAnimelist() {
  const data = [];

  function addEntry(title, started, finished) {
    if (title && finished && finished !== "-") {
      data.push({ title, started, finished });
    }
  }

  function collectRows(rows, extractRow) {
    rows.forEach((row) => {
      const entry = extractRow(row);
      if (entry) {
        addEntry(entry.title, entry.started, entry.finished);
      }
    });
  }

  collectRows(
    document.querySelectorAll(".list-table-data .list-table-row, .list-table-data"),
    (row) => {
      const title = row.querySelector(".title .link, .title a")?.innerText?.trim();
      const started = row.querySelector(".data.started, td.started")?.innerText?.trim();
      const finished = row.querySelector(".data.finished, td.finished")?.innerText?.trim();

      return title ? { title, started, finished } : null;
    }
  );

  if (data.length === 0) {
    collectRows(
      document.querySelectorAll("table.list-table tbody tr, #list-container .list-item"),
      (row) => {
        const cols = row.querySelectorAll("td");
        if (cols.length < 8) {
          return null;
        }

        return {
          title: cols[1]?.innerText?.trim(),
          started: cols[6]?.innerText?.trim(),
          finished: cols[7]?.innerText?.trim()
        };
      }
    );
  }

  return data;
}

// ── DOM References & Local State ────────────────────────────────────

const $ = (selector) => document.querySelector(selector);

const elements = {
  analyzeBtn: $("#analyze"),
  downloadBtn: $("#download"),
  status: $("#status"),
  output: $("#output"),
  summary: $("#summary"),
  minGapInput: $("#minGap"),
  sortSelect: $("#sortBy"),
  fromYearInput: $("#fromYear"),
  toYearInput: $("#toYear"),
  totalEntries: $("#totalEntries"),
  largestGap: $("#largestGap"),
  avgGap: $("#avgGap"),
  pageScoreInput: $("#pageScore"),
  applyScoreBtn: $("#applyScoreFilter"),
  clearScoreBtn: $("#clearScoreFilter"),
  calcBtn: $("#calcRating"),
  ratingResult: $("#rating-result"),
  ratingValue: $("#ratingValue"),
  ratingLabel: $("#ratingLabel"),
  ratingActual: $("#ratingActual")
};

const ratingInputs = RATING_INPUT_IDS.map((id) => document.getElementById(id));

const state = {
  rawGaps: [],
  currentReport: ""
};

// ── Popup UI Helpers ────────────────────────────────────────────────

function setHidden(element, hidden) {
  element.classList.toggle("hidden", hidden);
}

function setStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.className = type;
}

function clearStatus() {
  elements.status.className = "hidden";
  elements.status.textContent = "";
}

function setAnalyzeLoading(isLoading) {
  const spinner = elements.analyzeBtn.querySelector(".spinner");
  const text = elements.analyzeBtn.querySelector(".btn-text");

  setHidden(spinner, !isLoading);
  text.textContent = isLoading ? "Analyzing…" : "Analyze";
  elements.analyzeBtn.disabled = isLoading;
}

function resetAnalysisState() {
  state.rawGaps = [];
  state.currentReport = "";
  elements.output.textContent = "";
  setHidden(elements.summary, true);
  elements.downloadBtn.disabled = true;
}

// ── Gap Filter & Render Flow ────────────────────────────────────────

function renderSummary(gaps) {
  if (gaps.length === 0) {
    setHidden(elements.summary, true);
    return;
  }

  const gapValues = gaps.map((entry) => entry.gap);
  const largestGap = Math.max(...gapValues);
  const averageGap = (
    gapValues.reduce((total, value) => total + value, 0) / gapValues.length
  ).toFixed(1);

  elements.totalEntries.innerHTML = `<strong>${gaps.length}</strong> transitions`;
  elements.largestGap.innerHTML = `<strong>${largestGap}</strong> day max`;
  elements.avgGap.innerHTML = `<strong>${averageGap}</strong> day avg`;
  setHidden(elements.summary, false);
}

function getMinimumGap() {
  return Math.max(parseInt(elements.minGapInput.value, 10) || 0, 1);
}

function sortGaps(gaps, sortBy) {
  if (sortBy === "gap-desc") {
    gaps.sort((a, b) => b.gap - a.gap);
  } else if (sortBy === "gap-asc") {
    gaps.sort((a, b) => a.gap - b.gap);
  }

  return gaps;
}

function getDateRange() {
  const fromYear = parseInt(elements.fromYearInput.value, 10) || null;
  const toYear = parseInt(elements.toYearInput.value, 10) || null;
  return { fromYear, toYear };
}

function getFilteredGaps() {
  const minGap = getMinimumGap();
  const { fromYear, toYear } = getDateRange();

  let filtered = state.rawGaps.filter((entry) => entry.gap >= minGap);

  if (fromYear || toYear) {
    filtered = filtered.filter(({ current, next }) => {
      const finishYear = current.finishedDate.getFullYear();
      const startYear = next.startedDate?.getFullYear() ?? finishYear;

      if (fromYear && finishYear < fromYear && startYear < fromYear) return false;
      if (toYear && finishYear > toYear && startYear > toYear) return false;
      return true;
    });
  }

  return sortGaps([...filtered], elements.sortSelect.value);
}

function renderAnalysis() {
  const filteredGaps = getFilteredGaps();
  renderSummary(filteredGaps);
  state.currentReport = generateMarkdown(filteredGaps);
  elements.output.textContent = state.currentReport;
  elements.downloadBtn.disabled = filteredGaps.length === 0;
}

// ── Chrome Tab Access ───────────────────────────────────────────────

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isMalAnimelistTab(tab) {
  return Boolean(tab?.url?.startsWith(MAL_ANIMELIST_URL_PREFIX));
}

async function scrapeActiveTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: scrapeAnimelist
  });

  return results?.[0]?.result ?? [];
}

// ── Analyze Action ──────────────────────────────────────────────────

async function analyzeCurrentTab() {
  clearStatus();
  resetAnalysisState();

  const tab = await getActiveTab();
  if (!isMalAnimelistTab(tab)) {
    setStatus("Navigate to a MAL anime list page first (myanimelist.net/animelist/…)", "error");
    return;
  }

  setAnalyzeLoading(true);

  try {
    const data = await scrapeActiveTab(tab.id);

    if (data.length === 0) {
      setStatus("No completed anime found on this page. Make sure the list has finished dates visible.", "error");
      return;
    }

    state.rawGaps = detectGaps(data);
    setStatus(`Scraped ${data.length} entries, found ${state.rawGaps.length} transitions.`, "success");
    renderAnalysis();
  } catch (error) {
    console.error("MAL Gap Detector error:", error);
    setStatus(`Error: ${error.message}`, "error");
  } finally {
    setAnalyzeLoading(false);
  }
}

// ── Report Download ────────────────────────────────────────────────

function downloadReport() {
  if (!state.currentReport) {
    return;
  }

  const blob = new Blob([state.currentReport], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = REPORT_FILENAME;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Rating Calculator Helpers ───────────────────────────────────────

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampRatingInput(input) {
  const numericValue = parseInt(input.value, 10);
  if (Number.isNaN(numericValue)) {
    return;
  }

  input.value = clampValue(numericValue, 0, 10);
}

function getRatingLabel(rating) {
  const labels = {
    8: "Great",
    7: "Good",
    6: "Fine",
    5: "Average",
    4: "Below Average",
    3: "Bad",
    2: "Terrible",
    1: "Appalling"
  };

  if (rating >= 9) {
    return "Masterpiece";
  }

  return labels[rating] ?? "—";
}

function getRatingTier(rating) {
  if (rating >= 7) {
    return "green";
  }

  if (rating >= 4) {
    return "yellow";
  }

  return "red";
}

function getRatingValues() {
  return ratingInputs.map((input) => {
    const numericValue = parseFloat(input.value);
    return Number.isNaN(numericValue) ? null : clampValue(numericValue, 0, 10);
  });
}

function renderRatingError() {
  elements.ratingResult.className = "";
  elements.ratingResult.classList.add("rating-error");
  elements.ratingValue.textContent = "!";
  elements.ratingLabel.textContent = "Fill in all fields";
  elements.ratingActual.textContent = "";
}

function renderRatingResult(finalRating, averageRating) {
  elements.ratingResult.className = "";
  elements.ratingResult.classList.add(`rating-tier-${getRatingTier(finalRating)}`);
  elements.ratingValue.textContent = finalRating;
  elements.ratingLabel.textContent = `/ 10  ·  ${getRatingLabel(finalRating)}`;
  elements.ratingActual.textContent = `Actual: ${averageRating.toFixed(2)}`;
}

// ── Rating Calculation ──────────────────────────────────────────────

function calculateRating() {
  const values = getRatingValues();

  if (values.some((value) => value === null)) {
    renderRatingError();
    return;
  }

  const averageRating = values.reduce((total, value) => total + value, 0) / values.length;
  const finalRating = Math.round(averageRating);
  renderRatingResult(finalRating, averageRating);
}

// ── Date Range Presets ──────────────────────────────────────────────

function clearPresetSelection() {
  document.querySelectorAll(".preset-pill").forEach((pill) => pill.classList.remove("active"));
}

function applyPreset(preset) {
  clearPresetSelection();
  document.querySelector(`.preset-pill[data-preset="${preset}"]`)?.classList.add("active");

  if (preset === "all") {
    elements.fromYearInput.value = "";
    elements.toYearInput.value = "";
  } else {
    const years = parseInt(preset, 10);
    const currentYear = new Date().getFullYear();
    elements.fromYearInput.value = currentYear - years;
    elements.toYearInput.value = currentYear;
  }

  if (state.rawGaps.length > 0) {
    renderAnalysis();
  }
}

// ── Live Page Filters ───────────────────────────────────────────────

async function applyLiveScoreFilter() {
  const rawValue = elements.pageScoreInput.value;
  if (rawValue === "") {
    clearLiveScoreFilter();
    return;
  }

  const score = Math.max(0, Math.min(10, parseInt(rawValue, 10)));
  elements.pageScoreInput.value = score; 

  const tab = await getActiveTab();
  if (tab && isMalAnimelistTab(tab)) {
    chrome.tabs.sendMessage(tab.id, { action: "filterScore", score });
    setStatus(`Live page filtered to score: ${score === 0 ? 'Unrated' : score}`, "success");
  } else {
    setStatus("Navigate to a MAL anime list page to use live filters.", "error");
  }
}

async function clearLiveScoreFilter() {
  elements.pageScoreInput.value = "";
  const tab = await getActiveTab();
  if (tab && isMalAnimelistTab(tab)) {
    chrome.tabs.sendMessage(tab.id, { action: "filterScore", score: null });
    setStatus("Live filters cleared.", "info");
  }
}

// ── Event Wiring & Init ─────────────────────────────────────────────

function bindEvents() {
  elements.analyzeBtn.addEventListener("click", analyzeCurrentTab);
  elements.downloadBtn.addEventListener("click", downloadReport);
  
  elements.applyScoreBtn.addEventListener("click", applyLiveScoreFilter);
  elements.clearScoreBtn.addEventListener("click", clearLiveScoreFilter);
  elements.minGapInput.addEventListener("input", () => {
    if (state.rawGaps.length > 0) {
      renderAnalysis();
    }
  });
  elements.sortSelect.addEventListener("change", () => {
    if (state.rawGaps.length > 0) {
      renderAnalysis();
    }
  });
  elements.fromYearInput.addEventListener("input", () => {
    clearPresetSelection();
    if (state.rawGaps.length > 0) {
      renderAnalysis();
    }
  });
  elements.toYearInput.addEventListener("input", () => {
    clearPresetSelection();
    if (state.rawGaps.length > 0) {
      renderAnalysis();
    }
  });
  document.querySelectorAll(".preset-pill").forEach((pill) => {
    pill.addEventListener("click", () => applyPreset(pill.dataset.preset));
  });
  elements.calcBtn.addEventListener("click", calculateRating);

  ratingInputs.forEach((input) => {
    input.addEventListener("input", () => clampRatingInput(input));
  });
}

bindEvents();
