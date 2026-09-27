// Shared state helpers. Everything stays in chrome.storage.local on this device.
// Honest Headers never sends data anywhere.

export const STORAGE_KEY = "hh_state";
export const MAX_PROFILES = 50;
export const MAX_ROWS = 100;

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function newHeader(name = "", value = "") {
  return { id: uid(), enabled: true, name, value };
}

export function newFilter(pattern = "") {
  return { id: uid(), enabled: true, pattern };
}

export function newProfile(name = "Profile 1") {
  return {
    id: uid(),
    name,
    requestHeaders: [newHeader()],
    responseHeaders: [],
    urlFilters: []
  };
}

export function defaultState() {
  const p = newProfile("Profile 1");
  return { version: 1, paused: false, activeProfileId: p.id, profiles: [p] };
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
  const profiles = raw.profiles.slice(0, MAX_PROFILES).map((p, i) => ({
    id: p.id || uid(),
    name: String(p.name || `Profile ${i + 1}`).slice(0, 60),
    requestHeaders: cleanRows(p.requestHeaders, false),
    responseHeaders: cleanRows(p.responseHeaders, false),
    urlFilters: cleanRows(p.urlFilters, true)
  }));
  const active = profiles.find((p) => p.id === raw.activeProfileId) ? raw.activeProfileId : profiles[0].id;
  return { version: 1, paused: !!raw.paused, activeProfileId: active, profiles };
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

export function countActive(state) {
  if (state.paused) return 0;
  const p = activeProfile(state);
  return effectiveHeaders(p.requestHeaders).length + effectiveHeaders(p.responseHeaders).length;
}
