// Turns the saved profile into Chrome declarativeNetRequest rules.
import { activeProfile, effectiveHeaders } from "./state.js";

export const RESOURCE_TYPES = [
  "main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object",
  "xmlhttprequest", "ping", "csp_report", "media", "websocket", "webtransport", "webbundle", "other"
];

function toActions(rows) {
  return effectiveHeaders(rows).map((r) => {
    const header = r.name.trim();
    // An empty value means "remove this header", same as most header tools.
    return r.value === "" ? { header, operation: "remove" } : { header, operation: "set", value: r.value };
  });
}

// Returns the list of rules for the current state (empty when paused or nothing to do).
export function buildRules(state) {
  if (state.paused) return [];
  const p = activeProfile(state);
  const requestHeaders = toActions(p.requestHeaders);
  const responseHeaders = toActions(p.responseHeaders);
  if (requestHeaders.length === 0 && responseHeaders.length === 0) return [];

  const action = { type: "modifyHeaders" };
  if (requestHeaders.length) action.requestHeaders = requestHeaders;
  if (responseHeaders.length) action.responseHeaders = responseHeaders;

  const filters = p.urlFilters.filter((f) => f.enabled && f.pattern.trim());
  const conditions = filters.length
    ? filters.map((f) => ({ regexFilter: f.pattern.trim(), resourceTypes: RESOURCE_TYPES }))
    : [{ resourceTypes: RESOURCE_TYPES }];

  return conditions.map((condition, i) => ({ id: i + 1, priority: 1, action, condition }));
}
