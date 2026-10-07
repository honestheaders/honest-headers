// Shared state helpers. Everything stays in chrome.storage.local on this device.
// Honest Headers never sends data anywhere.

export const STORAGE_KEY = "hh_state";
export const MAX_PROFILES = 50;
export const MAX_ROWS = 100;
const TYPE_PRESETS_ALL = [
  "main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object",
  "xmlhttprequest", "ping", "csp_report", "media", "websocket", "webtransport", "webbundle", "other"
];

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function newHeader(name = "", value = "") {
  return { id: uid(), enabled: true, name, value };
}

export function newFilter(pattern = "") {
  return { id: uid(), enabled: true, pattern };
}

export function newRedirect(from = "", to = "") {
  return { id: uid(), enabled: true, from, to };
}

// Resource type presets (Pro). An empty list means "all types".
export const TYPE_PRESETS = {
  all: [],
  xhr: ["xmlhttprequest"],
  page: ["main_frame", "sub_frame"],
  assets: ["script", "stylesheet", "image", "font", "media"],
  websocket: ["websocket"]
};

export function newProfile(name = "Profile 1") {
  return {
    id: uid(),
    name,
    requestHeaders: [newHeader()],
    responseHeaders: [],
    urlFilters: [],
    excludeFilters: [],
    redirects: [],
    resourceTypes: []
  };
}

export function defaultState() {
  const p = newProfile("Profile 1");
  return { version: 1, paused: false, activeProfileId: p.id, profiles: [p], tabOnly: null, autoOffAt: null, proKey: "" };
}

// Repairs anything missing or malformed so the rest of the code can trust the shape.
export function normalizeState(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.profiles) || raw.profiles.length === 0) {
    return defaultState();
  }
  const cleanRows = (rows, isFilter) =>
    (Array.isArray(rows) ? rows : []).slice(0, MAX_ROWS).map((r) =>
      isFilter
        ? { id: r.id || uid(), enabled: r.enabled !== false, pattern: String(r.pattern ?? "") }
        : { id: r.id || uid(), enabled: r.enabled !== false, name: String(r.name ?? ""), value: String(r.value ?? "") }
    );
  const cleanRedirects = (rows) =>
    (Array.isArray(rows) ? rows : []).slice(0, MAX_ROWS).map((r) => ({
      id: r.id || uid(), enabled: r.enabled !== false, from: String(r.from ?? ""), to: String(r.to ?? "")
    }));
  const ALL_TYPES = TYPE_PRESETS_ALL;
  const profiles = raw.profiles.slice(0, MAX_PROFILES).map((p, i) => ({
    id: p.id || uid(),
    name: String(p.name || `Profile ${i + 1}`).slice(0, 60),
    requestHeaders: cleanRows(p.requestHeaders, false),
    responseHeaders: cleanRows(p.responseHeaders, false),
    urlFilters: cleanRows(p.urlFilters, true),
    excludeFilters: cleanRows(p.excludeFilters, true),
    redirects: cleanRedirects(p.redirects),
    resourceTypes: (Array.isArray(p.resourceTypes) ? p.resourceTypes : []).filter((t) => ALL_TYPES.includes(t))
  }));
  const active = profiles.find((p) => p.id === raw.activeProfileId) ? raw.activeProfileId : profiles[0].id;
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  return {
    version: 1, paused: !!raw.paused, activeProfileId: active, profiles,
    tabOnly: num(raw.tabOnly), autoOffAt: num(raw.autoOffAt), proKey: String(raw.proKey ?? "").slice(0, 64)
  };
}

export async function loadState() {
  const got = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeState(got[STORAGE_KEY]);
}

export async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: normalizeState(state) });
}

export function activeProfile(state) {
  return state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
}

// RFC 9110 token characters.
const TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
export function isValidHeaderName(name) {
  return TOKEN_RE.test(name);
}

export function isValidHeaderValue(value) {
  // No CR/LF or other control characters (tab is allowed).
  return !/[\u0000-\u0008\u000A-\u001F\u007F]/.test(value);
}

// Rows that will actually be applied.
export function effectiveHeaders(rows) {
  return rows.filter((r) => r.enabled && r.name.trim() && isValidHeaderName(r.name.trim()) && isValidHeaderValue(r.value));
}

export function effectiveRedirects(rows) {
  return rows.filter((r) => r.enabled && r.from.trim() && r.to.trim());
}

export function countActive(state, pro = false) {
  if (state.paused) return 0;
  const p = activeProfile(state);
  return effectiveHeaders(p.requestHeaders).length + effectiveHeaders(p.responseHeaders).length +
    (pro ? effectiveRedirects(p.redirects).length : 0);
}
