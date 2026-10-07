// Import / export. Accepts Honest Headers backups and ModHeader profile exports.
import { uid, normalizeState } from "./state.js";

export function exportState(state) {
  return JSON.stringify({ format: "honest-headers", version: 1, exportedAt: new Date().toISOString(), profiles: state.profiles }, null, 2);
}

const mapHeaders = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((h) => h && typeof h === "object")
    .map((h) => ({ id: uid(), enabled: h.enabled !== false, name: String(h.name ?? ""), value: String(h.value ?? "") }));

function mapModHeaderFilters(p) {
  const out = [];
  const push = (f) => {
    const pattern = f && (f.urlRegex ?? f.pattern ?? f.url);
    if (pattern) out.push({ id: uid(), enabled: f.enabled !== false, pattern: String(pattern) });
  };
  (Array.isArray(p.urlFilters) ? p.urlFilters : []).forEach(push);
  // Older ModHeader versions kept URL filters in a mixed "filters" list.
  (Array.isArray(p.filters) ? p.filters : []).filter((f) => !f.type || f.type === "urls").forEach(push);
  return out;
}

function fromModHeaderProfile(p, i) {
  return {
    id: uid(),
    name: String(p.title || p.name || `Imported ${i + 1}`),
    requestHeaders: mapHeaders(p.headers ?? p.reqHeaders ?? p.requestHeaders),
    responseHeaders: mapHeaders(p.respHeaders ?? p.responseHeaders),
    urlFilters: mapModHeaderFilters(p),
    excludeFilters: (Array.isArray(p.excludeUrlFilters) ? p.excludeUrlFilters : [])
      .map((f) => f && (f.urlRegex ?? f.pattern ?? f.url) ? { id: uid(), enabled: f.enabled !== false, pattern: String(f.urlRegex ?? f.pattern ?? f.url) } : null)
      .filter(Boolean)
  };
}

// Returns { profiles, source } or throws an Error with a user-facing key.
export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch (_) { throw new Error("importBadJson"); }

  if (data && data.format === "honest-headers" && Array.isArray(data.profiles)) {
    const fixed = normalizeState({ profiles: data.profiles }).profiles.map((p) => ({ ...p, id: uid() }));
    return { profiles: fixed, source: "Honest Headers" };
  }

  const list = Array.isArray(data) ? data : Array.isArray(data?.profiles) ? data.profiles : data && typeof data === "object" ? [data] : null;
  if (!list || list.length === 0) throw new Error("importNothing");

  const raw = list.filter((p) => p && typeof p === "object");
  const profiles = raw.map(fromModHeaderProfile);
  const useful = profiles.filter((p) => p.requestHeaders.length || p.responseHeaders.length || p.urlFilters.length);
  if (useful.length === 0) throw new Error("importNothing");
  // Settings Honest Headers does not support yet. We tell the user instead of silently dropping them.
  const UNSUPPORTED = ["cookieHeaders", "setCookieHeaders", "resourceFilters", "tabFilters",
    "tabGroupFilters", "windowFilters", "timeFilters", "urlReplacements", "csp"];
  const skipped = raw.some((p) => UNSUPPORTED.some((k) => Array.isArray(p[k]) && p[k].some((x) => x && x.enabled !== false)));
  return { profiles: normalizeState({ profiles: useful }).profiles, source: "ModHeader", skipped };
}
