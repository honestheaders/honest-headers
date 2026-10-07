// Turns the saved profile into Chrome declarativeNetRequest rules.
import { activeProfile, effectiveHeaders, effectiveRedirects } from "./state.js";

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

// All regex patterns the current state would use (for checking before applying).
export function usedRegexes(state, pro) {
  const p = activeProfile(state);
  const on = (rows, key) => rows.filter((r) => r.enabled && r[key].trim()).map((r) => r[key].trim());
  return [...on(p.urlFilters, "pattern"), ...on(p.excludeFilters, "pattern"), ...(pro ? on(p.redirects, "from") : [])];
}

// Returns the rules for the current state (empty when paused or nothing to do).
// Free: request/response headers, include filters, exclude filters.
// Pro: resource types, redirects, "this tab only" (the caller puts those rules in the session set).
export function buildRules(state, pro = false) {
  if (state.paused) return [];
  const p = activeProfile(state);
  const types = pro && p.resourceTypes.length ? p.resourceTypes : RESOURCE_TYPES;
  const tab = pro && typeof state.tabOnly === "number" ? { tabIds: [state.tabOnly] } : {};
  const rules = [];
  const add = (r) => rules.push({ id: rules.length + 1, ...r });

  const requestHeaders = toActions(p.requestHeaders);
  const responseHeaders = toActions(p.responseHeaders);
  if (requestHeaders.length || responseHeaders.length) {
    const action = { type: "modifyHeaders" };
    if (requestHeaders.length) action.requestHeaders = requestHeaders;
    if (responseHeaders.length) action.responseHeaders = responseHeaders;
    const filters = p.urlFilters.filter((f) => f.enabled && f.pattern.trim());
    const conditions = filters.length
      ? filters.map((f) => ({ regexFilter: f.pattern.trim(), resourceTypes: types, ...tab }))
      : [{ resourceTypes: types, ...tab }];
    conditions.forEach((condition) => add({ priority: 1, action, condition }));
  }

  if (pro) {
    for (const r of effectiveRedirects(p.redirects)) {
      add({
        priority: 1,
        action: { type: "redirect", redirect: { regexSubstitution: r.to.trim() } },
        condition: { regexFilter: r.from.trim(), resourceTypes: types, ...tab }
      });
    }
  }

  // Exclusions win over everything above (higher priority "allow").
  if (rules.length) {
    for (const f of p.excludeFilters.filter((x) => x.enabled && x.pattern.trim())) {
      add({ priority: 2, action: { type: "allow" }, condition: { regexFilter: f.pattern.trim(), resourceTypes: RESOURCE_TYPES, ...tab } });
    }
  }
  return rules;
}
