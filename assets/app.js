const fallbackNode = document.querySelector("#fallbackSites");
const fallbackSites = fallbackNode ? JSON.parse(fallbackNode.textContent) : [];

const elements = {
  grid: document.querySelector("#siteGrid"),
  emptyState: document.querySelector("#emptyState"),
  resultCount: document.querySelector("#resultCount"),
  siteCount: document.querySelector("#siteCount"),
  tagCount: document.querySelector("#tagCount"),
  search: document.querySelector("#siteSearch"),
  tagFilter: document.querySelector("#tagFilter"),
  template: document.querySelector("#siteCardTemplate")
};

const state = {
  sites: [],
  query: "",
  tag: "all"
};

init();

async function init() {
  state.sites = await loadSites();
  populateTagFilter(state.sites);
  bindEvents();
  render();
}

async function loadSites() {
  try {
    const response = await fetch("./sites.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Could not load sites.json: ${response.status}`);
    }

    return normaliseSites(await response.json());
  } catch (error) {
    console.warn(error);
    return normaliseSites(fallbackSites);
  }
}

function normaliseSites(sites) {
  return sites
    .filter((site) => site && site.title && site.path)
    .map((site) => ({
      title: site.title,
      slug: site.slug || slugify(site.title),
      description: site.description || "",
      path: site.path,
      status: site.status || "draft",
      tags: Array.isArray(site.tags) ? site.tags : [],
      accent: site.accent || "#23766b",
      secondary: site.secondary || "#d95f52"
    }));
}

function populateTagFilter(sites) {
  const tags = getTags(sites);
  elements.tagCount.textContent = String(tags.length);

  for (const tag of tags) {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    elements.tagFilter.append(option);
  }
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  elements.tagFilter.addEventListener("change", (event) => {
    state.tag = event.target.value;
    render();
  });
}

function render() {
  const filteredSites = state.sites.filter((site) => {
    const matchesQuery = [site.title, site.description, site.status, ...site.tags]
      .join(" ")
      .toLowerCase()
      .includes(state.query);
    const matchesTag = state.tag === "all" || site.tags.includes(state.tag);

    return matchesQuery && matchesTag;
  });

  elements.siteCount.textContent = String(state.sites.length);
  elements.resultCount.textContent = `${filteredSites.length} item${filteredSites.length === 1 ? "" : "s"}`;
  elements.emptyState.hidden = filteredSites.length > 0;
  elements.grid.replaceChildren(...filteredSites.map(createCard));
}

function createCard(site) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  const link = card.querySelector(".site-link");
  const preview = card.querySelector(".preview");
  const title = card.querySelector("h3");
  const status = card.querySelector(".status");
  const description = card.querySelector(".description");
  const tags = card.querySelector(".tags");

  link.href = site.path;
  preview.style.setProperty("--accent", site.accent);
  preview.style.setProperty("--secondary", site.secondary);
  title.textContent = site.title;
  status.textContent = site.status;
  description.textContent = site.description;

  for (const tag of site.tags) {
    const tagNode = document.createElement("span");
    tagNode.className = "tag";
    tagNode.textContent = tag;
    tags.append(tagNode);
  }

  return card;
}

function getTags(sites) {
  return [...new Set(sites.flatMap((site) => site.tags))].sort((a, b) => a.localeCompare(b));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
