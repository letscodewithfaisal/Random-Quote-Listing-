
// ============================================================
// THE COMMONPLACE 2.0
// FreeAPI Quotes + Personal Reading Room
// ============================================================

const API_BASE =
  "https://api.freeapi.app/api/v1/public/quotes";

const PAGE_LIMIT = 20;
const MAX_HISTORY = 50;

const STORAGE = {
  saved: "commonplace_saved",
  history: "commonplace_history",
  explored: "commonplace_explored",
  daily: "commonplace_daily",
};

// ============================================================
// STORAGE HELPERS
// ============================================================

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Could not save browser data:", error);
    showStatus("Storage is unavailable in this browser.", "featuredStatus");
  }
}

const state = {
  page: 1,
  totalPages: null,
  quotes: [],
  activeTag: null,
  searchTerm: "",
  lastFeaturedId: null,

  saved: readStorage(STORAGE.saved, []),
  history: readStorage(STORAGE.history, []),
  explored: readStorage(STORAGE.explored, []),

  daily: null,
  currentQuote: null,
};

// ============================================================
// DOM ELEMENTS
// ============================================================

const $ = (id) => document.getElementById(id);

const grid = $("grid");
const emptyState = $("emptyState");
const resultCount = $("resultCount");
const loadMoreBtn = $("loadMoreBtn");
const loadStatus = $("loadStatus");
const searchInput = $("searchInput");
const tagChips = $("tagChips");

const pullBtn = $("pullBtn");
const featuredCard = $("featuredCard");
const featuredQuote = $("featuredQuote");
const featuredAuthor = $("featuredAuthor");
const featuredStamp = $("featuredStamp");

const catalogView = $("catalogView");
const readingRoomView = $("readingRoomView");
const catalogNav = $("catalogNav");
const readingRoomNav = $("readingRoomNav");

// ============================================================
// START APPLICATION
// ============================================================

init();

async function init() {
  bindNavigation();
  bindCatalogControls();
  bindReadingRoomControls();

  await loadPage(1);

  if (!state.quotes.length) {
    featuredQuote.textContent =
      "The catalog could not be loaded. Please refresh and try again.";
    return;
  }

  setupDailyQuote();
  await pickFeatured(false);

  render();
  renderReadingRoom();
}

// ============================================================
// NAVIGATION
// ============================================================

function bindNavigation() {
  catalogNav.addEventListener("click", showCatalog);
  readingRoomNav.addEventListener("click", showReadingRoom);

  $("backToCatalogBtn").addEventListener("click", showCatalog);
  $("dailyRoomBtn").addEventListener("click", showReadingRoom);
}

function showCatalog() {
  catalogView.hidden = false;
  readingRoomView.hidden = true;

  catalogNav.classList.add("active");
  readingRoomNav.classList.remove("active");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showReadingRoom() {
  catalogView.hidden = true;
  readingRoomView.hidden = false;

  catalogNav.classList.remove("active");
  readingRoomNav.classList.add("active");

  renderReadingRoom();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// CATALOG CONTROLS
// ============================================================

function bindCatalogControls() {
  loadMoreBtn.addEventListener("click", async () => {
    if (
      loadMoreBtn.disabled ||
      (state.totalPages !== null &&
        state.page >= state.totalPages)
    ) {
      return;
    }

    loadMoreBtn.disabled = true;
    loadStatus.textContent = "Pulling the next drawer...";

    const nextPage = state.page + 1;
    const success = await loadPage(nextPage);

    if (success) {
      state.page = nextPage;
      render();
    }

    loadStatus.textContent = "";

    loadMoreBtn.disabled =
      !success ||
      (state.totalPages !== null &&
        state.page >= state.totalPages);
  });

  searchInput.addEventListener("input", (event) => {
    state.searchTerm =
      event.target.value.trim().toLowerCase();

    render();
  });

  pullBtn.addEventListener("click", async () => {
    if (pullBtn.disabled) return;

    pullBtn.disabled = true;
    pullBtn.classList.add("spinning");
    featuredCard.classList.add("pulling");

    await pickFeatured(true);

    setTimeout(() => {
      pullBtn.disabled = false;
      pullBtn.classList.remove("spinning");
      featuredCard.classList.remove("pulling");
    }, 300);
  });

  $("saveFeaturedBtn").addEventListener("click", () => {
    if (state.currentQuote) {
      toggleSaved(state.currentQuote);
    }
  });

  $("copyFeaturedBtn").addEventListener("click", () => {
    copyQuote(state.currentQuote, "featuredStatus");
  });

  $("shareFeaturedBtn").addEventListener("click", () => {
    shareQuote(state.currentQuote, "featuredStatus");
  });

  grid.addEventListener("click", handleCardActions);
}

// ============================================================
// API: LOAD QUOTE PAGES
// ============================================================

async function loadPage(page) {
  try {
    const response = await fetch(
      `${API_BASE}?page=${page}&limit=${PAGE_LIMIT}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    const payload = json.data;

    if (!payload || !Array.isArray(payload.data)) {
      throw new Error("Unexpected API response.");
    }

    state.totalPages = Number(payload.totalPages) || 1;

    const quotes = payload.data
      .map(normalizeQuote)
      .filter((quote) => quote.content);

    addUniqueQuotes(quotes);
    buildTagChips();

    if (state.page >= state.totalPages) {
      loadMoreBtn.textContent = "The whole drawer is out";
    } else {
      loadMoreBtn.textContent = "Open the next drawer";
    }

    return true;
  } catch (error) {
    console.error("Quote loading error:", error);

    loadStatus.textContent =
      "Couldn't reach the catalog. Check your connection and try again.";

    return false;
  }
}

function normalizeQuote(q) {
  return {
    id: String(q._id),
    author: q.author || "Unknown",
    content: q.content || "",
    tags: Array.isArray(q.tags) ? q.tags : [],
  };
}

function addUniqueQuotes(quotes) {
  const existing = new Set(
    state.quotes.map((quote) => quote.id)
  );

  quotes.forEach((quote) => {
    if (!existing.has(quote.id)) {
      state.quotes.push(quote);
      existing.add(quote.id);
    }
  });
}

// ============================================================
// SUBJECT TAGS
// ============================================================

function buildTagChips() {
  const tags = new Set();

  state.quotes.forEach((quote) => {
    quote.tags.forEach((tag) => tags.add(tag));
  });

  tagChips.innerHTML = "";

  Array.from(tags)
    .sort()
    .slice(0, 16)
    .forEach((tag) => {
      const button = document.createElement("button");

      button.className =
        "tag-chip" +
        (state.activeTag === tag ? " active" : "");

      button.type = "button";
      button.textContent = tag;

      button.addEventListener("click", () => {
        state.activeTag =
          state.activeTag === tag ? null : tag;

        buildTagChips();
        render();
      });

      tagChips.appendChild(button);
    });
}

// ============================================================
// SEARCH AND FILTER
// ============================================================

function getFiltered() {
  return state.quotes.filter((quote) => {
    const matchesTag =
      !state.activeTag ||
      quote.tags.includes(state.activeTag);

    const searchable =
      `${quote.author} ${quote.content}`.toLowerCase();

    const matchesSearch =
      !state.searchTerm ||
      searchable.includes(state.searchTerm);

    return matchesTag && matchesSearch;
  });
}

// ============================================================
// CATALOG RENDERING
// ============================================================

function render() {
  const filtered = getFiltered();

  grid.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  filtered.forEach((quote, index) => {
    const card = createQuoteCard(quote, index);
    grid.appendChild(card);
  });

  resultCount.textContent =
    `Showing ${filtered.length} of ${state.quotes.length} cards loaded` +
    (state.totalPages
      ? ` (drawer ${state.page} of ${state.totalPages})`
      : "");
}

function createQuoteCard(quote, index = 0) {
  const card = document.createElement("article");
  card.className = "card";
  card.style.animationDelay =
    `${Math.min(index, 12) * 30}ms`;

  const number = document.createElement("p");
  number.className = "card-index";
  number.textContent =
    `CATALOG NO. ${String(quote.id).slice(-8)}`;

  const content = document.createElement("blockquote");
  content.textContent = quote.content;

  const author = document.createElement("p");
  author.className = "card-author";
  author.textContent = quote.author;

  card.append(number, content, author);

  if (quote.tags.length) {
    const tagWrap = document.createElement("div");
    tagWrap.className = "card-tags";

    quote.tags.forEach((tag) => {
      const tagElement = document.createElement("span");
      tagElement.className = "card-tag";
      tagElement.textContent = tag;
      tagWrap.appendChild(tagElement);
    });

    card.appendChild(tagWrap);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const saveButton = document.createElement("button");
  saveButton.className = "action-btn";
  saveButton.type = "button";
  saveButton.dataset.action = "save";
  saveButton.dataset.id = quote.id;

  saveButton.textContent = isSaved(quote.id)
    ? "♥ Saved"
    : "♡ Save";

  const copyButton = document.createElement("button");
  copyButton.className = "action-btn";
  copyButton.type = "button";
  copyButton.dataset.action = "copy";
  copyButton.dataset.id = quote.id;
  copyButton.textContent = "Copy";

  actions.append(saveButton, copyButton);
  card.appendChild(actions);

  return card;
}

function handleCardActions(event) {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const quote = findQuote(button.dataset.id);
  if (!quote) return;

  if (button.dataset.action === "save") {
    toggleSaved(quote);
  }

  if (button.dataset.action === "copy") {
    copyQuote(quote, "featuredStatus");
  }
}

// ============================================================
// RANDOM FEATURED QUOTE
// ============================================================

async function pickFeatured(forceRandomPage = false) {
  let pool = state.quotes;

  if (forceRandomPage && state.totalPages > 1) {
    const randomPage =
      1 + Math.floor(Math.random() * state.totalPages);

    try {
      const response = await fetch(
        `${API_BASE}?page=${randomPage}&limit=${PAGE_LIMIT}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Random page unavailable.");
      }

      const json = await response.json();
      const fetched = json.data.data
        .map(normalizeQuote)
        .filter((quote) => quote.content);

      addUniqueQuotes(fetched);

      if (fetched.length) {
        pool = fetched;
      }

      buildTagChips();
      render();
    } catch (error) {
      console.warn("Using already loaded cards:", error);
    }
  }

  let candidates = pool.filter(
    (quote) => quote.id !== state.lastFeaturedId
  );

  if (!candidates.length) {
    candidates = state.quotes.filter(
      (quote) => quote.id !== state.lastFeaturedId
    );
  }

  if (!candidates.length) return;

  const quote =
    candidates[Math.floor(Math.random() * candidates.length)];

  state.lastFeaturedId = quote.id;
  state.currentQuote = quote;

  featuredQuote.textContent = quote.content;
  featuredAuthor.textContent = quote.author;
  featuredStamp.textContent =
    `CARD #${String(quote.id).slice(-8)}`;

  updateFeaturedSaveButton();
  recordReading(quote);
}

// ============================================================
// SAVE TO MY COLLECTION
// ============================================================

function isSaved(id) {
  return state.saved.some(
    (quote) => quote.id === String(id)
  );
}

function toggleSaved(quote) {
  if (!quote) return;

  const existingIndex = state.saved.findIndex(
    (item) => item.id === quote.id
  );

  if (existingIndex !== -1) {
    state.saved.splice(existingIndex, 1);
    showStatus("Removed from your collection.", "featuredStatus");
  } else {
    state.saved.unshift(quote);
    showStatus("Added to your collection ♥", "featuredStatus");
  }

  writeStorage(STORAGE.saved, state.saved);

  updateFeaturedSaveButton();
  render();
  renderReadingRoom();
}

function updateFeaturedSaveButton() {
  if (!state.currentQuote) return;

  $("saveFeaturedBtn").textContent =
    isSaved(state.currentQuote.id)
      ? "♥ Saved"
      : "♡ Save";
}

// ============================================================
// READING HISTORY
// ============================================================

function recordReading(quote) {
  if (!quote) return;

  // Track unique quotations explored.
  if (
    !state.explored.some((item) => item.id === quote.id)
  ) {
    state.explored.unshift(quote);
    writeStorage(STORAGE.explored, state.explored);
  }

  // Avoid consecutive duplicate history entries.
  if (state.history[0]?.id !== quote.id) {
    state.history.unshift({
      ...quote,
      viewedAt: new Date().toISOString(),
    });
  }

  state.history = state.history.slice(0, MAX_HISTORY);

  writeStorage(STORAGE.history, state.history);

  renderStatistics();
}

function clearHistory() {
  if (!state.history.length) return;

  if (!confirm("Clear your entire reading history?")) return;

  state.history = [];

  writeStorage(STORAGE.history, state.history);

  renderReadingRoom();
}

// ============================================================
// QUOTE OF THE DAY
// ============================================================

function getTodayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function setupDailyQuote() {
  const today = getTodayKey();
  const stored = readStorage(STORAGE.daily, null);

  if (
    stored &&
    stored.date === today &&
    stored.quote &&
    stored.quote.id
  ) {
    state.daily = stored.quote;
  } else {
    const quotes = state.quotes;

    const dateSeed = today
      .split("-")
      .join("")
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);

    const index = dateSeed % quotes.length;

    state.daily = quotes[index];

    writeStorage(STORAGE.daily, {
      date: today,
      quote: state.daily,
    });
  }

  $("dailyPreviewQuote").textContent =
    state.daily.content;

  $("dailyPreviewAuthor").textContent =
    "— " + state.daily.author;

  $("dailyQuote").textContent =
    state.daily.content;

  $("dailyAuthor").textContent =
    state.daily.author;

  updateDailySaveButton();
}

// ============================================================
// COPY QUOTE
// ============================================================

async function copyQuote(quote, statusId) {
  if (!quote) return;

  const text =
    `"${quote.content}"\n— ${quote.author}`;

  try {
    await navigator.clipboard.writeText(text);

    showStatus("Quotation copied to clipboard!", statusId);
  } catch {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.select();

    try {
      const success = document.execCommand("copy");

      showStatus(
        success ? "Quotation copied!" : "Could not copy quotation.",
        statusId
      );
    } catch {
      showStatus("Copy is not supported in this browser.", statusId);
    }

    textarea.remove();
  }
}

// ============================================================
// SHARE QUOTE
// ============================================================

async function shareQuote(quote, statusId) {
  if (!quote) return;

  const text =
    `"${quote.content}"\n— ${quote.author}\n\nThe Commonplace · FreeAPI Reading Room`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "A quotation from The Commonplace",
        text,
      });

      showStatus("Quotation shared!", statusId);
    } catch (error) {
      if (error.name !== "AbortError") {
        showStatus("Unable to share this quotation.", statusId);
      }
    }
  } else {
    await copyQuote(quote, statusId);
  }
}

// ============================================================
// READING ROOM CONTROLS
// ============================================================

function bindReadingRoomControls() {
  $("copyDailyBtn").addEventListener("click", () => {
    copyQuote(state.daily, "dailyStatus");
  });

  $("shareDailyBtn").addEventListener("click", () => {
    shareQuote(state.daily, "dailyStatus");
  });

  $("saveDailyBtn").addEventListener("click", () => {
    toggleDailySaved();
  });

  $("clearHistoryBtn").addEventListener("click", clearHistory);

  $("collectionGrid").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const quote = findQuote(button.dataset.id);
    if (!quote) return;

    if (button.dataset.action === "save") {
      toggleSaved(quote);
    }

    if (button.dataset.action === "copy") {
      copyQuote(quote, "dailyStatus");
    }

    if (button.dataset.action === "share") {
      shareQuote(quote, "dailyStatus");
    }
  });

  $("historyList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-id]");

    if (!button) return;

    const quote = findQuote(button.dataset.historyId);

    if (quote) {
      state.currentQuote = quote;
      state.lastFeaturedId = quote.id;

      featuredQuote.textContent = quote.content;
      featuredAuthor.textContent = quote.author;
      featuredStamp.textContent =
        `CARD #${String(quote.id).slice(-8)}`;

      updateFeaturedSaveButton();
      showCatalog();
    }
  });
}

function toggleDailySaved() {
  if (!state.daily) return;

  toggleSaved(state.daily);
  updateDailySaveButton();
}

function updateDailySaveButton() {
  if (!state.daily) return;

  $("saveDailyBtn").textContent =
    isSaved(state.daily.id) ? "♥ Saved" : "♡ Save";
}

// ============================================================
// READING ROOM RENDERING
// ============================================================

function renderReadingRoom() {
  renderStatistics();
  renderCollection();
  renderHistory();
  updateDailySaveButton();
  updateFeaturedSaveButton();
}

function renderStatistics() {
  $("statExplored").textContent = state.explored.length;
  $("statSaved").textContent = state.saved.length;
  $("statHistory").textContent = state.history.length;

  const authors = new Set(
    state.explored.map((quote) => quote.author)
  );

  $("statAuthors").textContent = authors.size;
}

// ============================================================
// COLLECTION RENDERING
// ============================================================

function renderCollection() {
  const container = $("collectionGrid");
  const empty = $("collectionEmpty");

  container.innerHTML = "";

  $("collectionCount").textContent =
    `${state.saved.length} CARDS`;

  empty.hidden = state.saved.length > 0;

  state.saved.forEach((quote, index) => {
    const card = createQuoteCard(quote, index);

    const actions = card.querySelector(".card-actions");

    const saveButton = actions.querySelector('[data-action="save"]');
    saveButton.textContent = "♥ Remove";

    const shareButton = document.createElement("button");
    shareButton.className = "action-btn";
    shareButton.type = "button";
    shareButton.dataset.action = "share";
    shareButton.dataset.id = quote.id;
    shareButton.textContent = "Share";

    actions.appendChild(shareButton);
    container.appendChild(card);
  });
}

// ============================================================
// HISTORY RENDERING
// ============================================================

function renderHistory() {
  const container = $("historyList");

  container.innerHTML = "";

  $("historyEmpty").hidden = state.history.length > 0;

  state.history.forEach((quote) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const content = document.createElement("div");
    content.className = "history-content";

    const text = document.createElement("p");
    text.className = "history-quote";
    text.textContent = quote.content;

    const author = document.createElement("p");
    author.className = "history-author";
    author.textContent = quote.author;

    const date = document.createElement("span");
    date.className = "history-date";

    const parsedDate = new Date(quote.viewedAt);

    date.textContent = Number.isNaN(parsedDate.getTime())
      ? ""
      : parsedDate.toLocaleString();

    const openButton = document.createElement("button");
    openButton.className = "history-open-btn";
    openButton.type = "button";
    openButton.textContent = "View card";
    openButton.dataset.historyId = quote.id;

    content.append(text, author);
    item.append(content, date, openButton);

    container.appendChild(item);
  });
}

// ============================================================
// UTILITIES
// ============================================================

function findQuote(id) {
  const allQuotes = [
    ...state.quotes,
    ...state.saved,
    ...state.history,
    ...(state.daily ? [state.daily] : []),
    ...(state.explored || []),
  ];

  return allQuotes.find(
    (quote) => quote.id === String(id)
  );
}

function showStatus(message, elementId) {
  const element = $(elementId);

  if (element) {
    element.textContent = message;
  }
}
