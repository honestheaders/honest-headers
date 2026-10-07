import { loadState, saveState, MAX_PROFILES } from "./lib/state.js";
import { parseImport, exportState } from "./lib/importers.js";
import { isPro, normalizeKey, BUY_URL } from "./lib/license.js";

const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;
const $ = (id) => document.getElementById(id);

document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
$("ver").textContent = chrome.runtime.getManifest().version;

function show(msg, ok) {
  const el = $("importResult");
  el.textContent = msg;
  el.className = "result " + (ok ? "ok" : "err");
}

async function doImport(text) {
  try {
    const { profiles, source, skipped } = parseImport(text);
    const state = await loadState();
    const room = MAX_PROFILES - state.profiles.length;
    if (room <= 0) { show(t("importFull"), false); return; }
    const added = profiles.slice(0, room);
    state.profiles.push(...added);
    // Imported profiles are NOT switched on automatically: the user picks one in the popup.
    await saveState(state);
    show(t("importDone", [String(added.length), source]) + (skipped ? " " + t("importSkipped") : ""), true);
  } catch (e) {
    show(t(e.message) || t("importBadJson"), false);
  }
}

$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { show(t("importTooBig"), false); return; }
  await doImport(await file.text());
  e.target.value = "";
});

$("importPaste").addEventListener("click", () => doImport($("importText").value));

$("exportBtn").addEventListener("click", async () => {
  const state = await loadState();
  const blob = new Blob([exportState(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `honest-headers-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ---- Pro ----
$("buyPro").href = BUY_URL;
async function renderProState() {
  const state = await loadState();
  const ok = await isPro(state);
  const el = $("proState");
  el.textContent = ok ? t("proOn") : t("proOff");
  el.className = "badge" + (ok ? " on" : "");
  if (ok) $("proKey").value = state.proKey;
}
$("proActivate").addEventListener("click", async () => {
  const key = normalizeKey($("proKey").value);
  const state = await loadState();
  const test = { ...state, proKey: key };
  const r = $("proResult");
  if (!(await isPro(test))) { r.textContent = t("proBadKey"); r.className = "result err"; return; }
  state.proKey = key;
  await saveState(state);
  r.textContent = t("proDone"); r.className = "result ok";
  renderProState();
});
renderProState();
if (location.hash === "#pro") document.getElementById("pro").scrollIntoView();
