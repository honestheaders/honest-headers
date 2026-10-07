// Background service worker: keeps Chrome's header rules in sync with the saved profile.
// No network requests, no analytics, no remote code.
import { STORAGE_KEY, loadState, saveState, countActive } from "./lib/state.js";
import { buildRules, usedRegexes } from "./lib/rules.js";
import { isPro } from "./lib/license.js";

const STATUS_KEY = "hh_status";
const ALARM = "hh_auto_off";

async function checkRegexes(state, pro) {
  const bad = [];
  if (state.paused) return bad;
  for (const re of usedRegexes(state, pro)) {
    const res = await chrome.declarativeNetRequest.isRegexSupported({ regex: re });
    if (!res.isSupported) bad.push(re);
  }
  return bad;
}

async function setRules(dynamicRules, sessionRules) {
  const d = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: d.map((r) => r.id), addRules: dynamicRules });
  const s = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: s.map((r) => r.id), addRules: sessionRules });
}

async function syncAlarm(state, pro) {
  await chrome.alarms.clear(ALARM);
  if (pro && !state.paused && state.autoOffAt) {
    if (state.autoOffAt <= Date.now()) return "expired";
    await chrome.alarms.create(ALARM, { when: state.autoOffAt });
  }
  return "";
}

async function applyState() {
  const state = await loadState();
  const pro = await isPro(state);
  if ((await syncAlarm(state, pro)) === "expired") {
    state.paused = true; state.autoOffAt = null;
    await saveState(state); // runs applyState again through onChanged
    return;
  }
  let error = "";
  try {
    const badRegex = await checkRegexes(state, pro);
    if (badRegex.length) {
      error = "regex:" + badRegex.join(" , ");
      // Fail closed: do not apply rules to the wrong URLs.
      await setRules([], []);
    } else {
      const rules = buildRules(state, pro);
      const tabMode = pro && typeof state.tabOnly === "number";
      // Rules limited to one tab must be session rules (Chrome only allows tabIds there).
      await setRules(tabMode ? [] : rules, tabMode ? rules : []);
    }
  } catch (e) {
    error = String(e && e.message ? e.message : e);
    try { await setRules([], []); } catch (_) { /* ignore */ }
  }
  await chrome.storage.local.set({ [STATUS_KEY]: { error, at: Date.now(), pro } });
  await updateBadge(state, error, pro);
}

async function updateBadge(state, error, pro) {
  let text = "";
  let color = "#2563eb";
  if (error) { text = "!"; color = "#dc2626"; }
  else if (state.paused) { text = "||"; color = "#6b7280"; }
  else {
    const n = countActive(state, pro);
    text = n > 0 ? String(n) : "";
    if (n > 0 && pro && typeof state.tabOnly === "number") color = "#7c3aed";
  }
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

async function update(fn) {
  const state = await loadState();
  if (fn(state) !== false) await saveState(state);
}

chrome.runtime.onInstalled.addListener(async () => {
  const got = await chrome.storage.local.get(STORAGE_KEY);
  if (!got[STORAGE_KEY]) await saveState(await loadState());
  await applyState();
});

// Session rules are gone after a restart, so "this tab only" is switched off too.
chrome.runtime.onStartup.addListener(async () => {
  await update((s) => { if (s.tabOnly === null) return false; s.tabOnly = null; });
  await applyState();
});

chrome.tabs.onRemoved.addListener((tabId) => update((s) => { if (s.tabOnly !== tabId) return false; s.tabOnly = null; }));

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) update((s) => { s.paused = true; s.autoOffAt = null; });
});

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-pause") update((s) => { s.paused = !s.paused; if (s.paused) s.autoOffAt = null; });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) applyState();
});
