// Background service worker: keeps Chrome's header rules in sync with the saved profile.
// No network requests, no analytics, no remote code.
import { STORAGE_KEY, loadState, saveState, countActive, activeProfile } from "./lib/state.js";
import { buildRules } from "./lib/rules.js";

const STATUS_KEY = "hh_status";

async function checkRegexes(state) {
  const bad = [];
  if (state.paused) return bad;
  for (const f of activeProfile(state).urlFilters) {
    if (!f.enabled || !f.pattern.trim()) continue;
    const res = await chrome.declarativeNetRequest.isRegexSupported({ regex: f.pattern.trim() });
    if (!res.isSupported) bad.push(f.pattern.trim());
  }
  return bad;
}

async function applyState() {
  const state = await loadState();
  let error = "";
  try {
    const badRegex = await checkRegexes(state);
    if (badRegex.length) {
      error = "regex:" + badRegex.join(" , ");
      // Fail closed: do not apply rules to the wrong URLs.
      await replaceRules([]);
    } else {
      await replaceRules(buildRules(state));
    }
  } catch (e) {
    error = String(e && e.message ? e.message : e);
    try { await replaceRules([]); } catch (_) { /* ignore */ }
  }
  await chrome.storage.local.set({ [STATUS_KEY]: { error, at: Date.now() } });
  await updateBadge(state, error);
}

async function replaceRules(rules) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: rules
  });
}

async function updateBadge(state, error) {
  let text = "";
  let color = "#2563eb";
  if (error) { text = "!"; color = "#dc2626"; }
  else if (state.paused) { text = "||"; color = "#6b7280"; }
  else {
    const n = countActive(state);
    text = n > 0 ? String(n) : "";
  }
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

chrome.runtime.onInstalled.addListener(async () => {
  const got = await chrome.storage.local.get(STORAGE_KEY);
  if (!got[STORAGE_KEY]) await saveState(await loadState());
  await applyState();
});

chrome.runtime.onStartup.addListener(applyState);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) applyState();
});
