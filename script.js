// ============================================================
// The Commonplace — quotes catalog
// Data source: FreeAPI public Quotes endpoint
// ============================================================

const API_BASE = "https://api.freeapi.app/api/v1/public/quotes";
const PAGE_LIMIT = 20;

const state = {
  page: 1,
  totalPages: null,
  quotes: [],       // all quotes loaded so far
  activeTag: null,
  searchTerm: "",
};

const grid = document.getElementById("grid");
const emptyState = document.getElementById("emptyState");
const resultCount = document.getElementById("resultCount");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const loadStatus = document.getElementById("loadStatus");
const searchInput = document.getElementById("searchInput");
const tagChips = document.getElementById("tagChips");
const pullBtn = document.getElementById("pullBtn");
const featuredCard = document.getElementById("featuredCard");
const featuredQuote = document.getElementById("featuredQuote");
const featuredAuthor = document.getElementById("featuredAuthor");
const featuredStamp = document.getElementById("featuredStamp");

init();

async function init() {
  await loadPage(state.page);
  pickFeatured();
  render();

  loadMoreBtn.addEventListener("click", async () => {
    state.page += 1;
    loadStatus.textContent = "Pulling the next drawer…";
    loadMoreBtn.disabled = true;
    await loadPage(state.page);
    render();
    loadStatus.textContent = "";
    loadMoreBtn.disabled = state.totalPages !== null && state.page >= state.totalPages;
  });

  searchInput.addEventListener("input", (e) => {
    state.searchTerm = e.target.value.trim().toLowerCase();
    render();
  });

  pullBtn.addEventListener("click", async () => {
    pullBtn.classList.add("spinning");
    featuredCard.classList.add("pulling");
    await pickFeatured(true);
    setTimeout(() => {
      featuredCard.classList.remove("pulling");
      pullBtn.classList.remove("spinning");
    }, 250);
  });
}

async function loadPage(page) {
  try {
    const res = await fetch(`${API_BASE}?page=${page}&limit=${PAGE_LIMIT}`);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const json = await res.json();
    const payload = json.data;
    state.totalPages = payload.totalPages;

    const newQuotes = payload.data.map(normalizeQuote);
    const existingIds = new Set(state.quotes.map((q) => q.id));
    for (const q of newQuotes) {
      if (!existingIds.has(q.id)) state.quotes.push(q);
    }

    if (state.totalPages !== null && state.page >= state.totalPages) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = "The whole drawer is out";
    }

    buildTagChips();
  } catch (err) {
    console.error(err);
    loadStatus.textContent = "Couldn't reach the catalog. Check your connection and try again.";
  }
}

function normalizeQuote(q) {
  return {
    id: q.id,
    author: q.author || "Unknown",
    content: q.content,
    tags: Array.isArray(q.tags) ? q.tags : [],
  };
}

function buildTagChips() {
  const tagSet = new Set();
  state.quotes.forEach((q) => q.tags.forEach((t) => tagSet.add(t)));
  const sortedTags = Array.from(tagSet).sort().slice(0, 16);

  tagChips.innerHTML = "";
  sortedTags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "tag-chip" + (state.activeTag === tag ? " active" : "");
    btn.type = "button";
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      state.activeTag = state.activeTag === tag ? null : tag;
      buildTagChips();
      render();
    });
    tagChips.appendChild(btn);
  });
}

function getFiltered() {
  return state.quotes.filter((q) => {
    const matchesTag = !state.activeTag || q.tags.includes(state.activeTag);
    const haystack = `${q.author} ${q.content}`.toLowerCase();
    const matchesSearch = !state.searchTerm || haystack.includes(state.searchTerm);
    return matchesTag && matchesSearch;
  });
}

function render() {
  const filtered = getFiltered();

  grid.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  filtered.forEach((q, i) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${Math.min(i, 12) * 30}ms`;

    const index = document.createElement("p");
    index.className = "card-index";
    index.textContent = `CATALOG NO. ${String(q.id).padStart(4, "0")}`;

    const quote = document.createElement("blockquote");
    quote.textContent = q.content;

    const author = document.createElement("p");
    author.className = "card-author";
    author.textContent = q.author;

    card.appendChild(index);
    card.appendChild(quote);
    card.appendChild(author);

    if (q.tags.length) {
      const tagWrap = document.createElement("div");
      tagWrap.className = "card-tags";
      q.tags.forEach((t) => {
        const tagEl = document.createElement("span");
        tagEl.className = "card-tag";
        tagEl.textContent = t;
        tagWrap.appendChild(tagEl);
      });
      card.appendChild(tagWrap);
    }

    grid.appendChild(card);
  });

  const total = state.quotes.length;
  resultCount.textContent = `Showing ${filtered.length} of ${total} cards loaded${
    state.totalPages ? ` (drawer ${state.page} of ${state.totalPages})` : ""
  }`;
}

async function pickFeatured(forceRandomPage = false) {
  let pool = state.quotes;

  // Occasionally reach into a page we haven't loaded yet, so "pull a card"
  // can surface quotes beyond what's currently on screen.
  if (forceRandomPage && state.totalPages) {
    const randomPage = 1 + Math.floor(Math.random() * state.totalPages);
    try {
      const res = await fetch(`${API_BASE}?page=${randomPage}&limit=${PAGE_LIMIT}`);
      if (res.ok) {
        const json = await res.json();
        const fetched = json.data.data.map(normalizeQuote);
        const existingIds = new Set(state.quotes.map((q) => q.id));
        fetched.forEach((q) => { if (!existingIds.has(q.id)) state.quotes.push(q); });
        pool = fetched;
        buildTagChips();
        render();
      }
    } catch (err) {
      console.warn("Random pull fell back to loaded cards:", err);
    }
  }

  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  featuredQuote.textContent = pick.content;
  featuredAuthor.textContent = pick.author;
  featuredStamp.textContent = `CARD #${String(pick.id).padStart(3, "0")}`;
}
