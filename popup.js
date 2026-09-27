import { loadState, saveState, activeProfile, newHeader, newFilter, newProfile, uid,
  isValidHeaderName, isValidHeaderValue, effectiveHeaders, MAX_PROFILES, MAX_ROWS, STORAGE_KEY } from "./lib/state.js";

const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;
const $ = (id) => document.getElementById(id);

let state;
let tab = "requestHeaders";
let saveTimer = null;
let deleteArmed = false;

function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
}

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(state), 250);
}
function saveNow() {
  clearTimeout(saveTimer);
  return saveState(state);
}

function renderToggle() {
  $("enabledToggle").checked = !state.paused;
  $("enabledLabel").textContent = state.paused ? t("paused") : t("active");
}

function renderProfiles() {
  const sel = $("profileSelect");
  sel.innerHTML = "";
  for (const p of state.profiles) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    sel.appendChild(o);
  }
  sel.value = state.activeProfileId;
  $("deleteProfile").disabled = state.profiles.length <= 1;
}

function renderCounts() {
  const p = activeProfile(state);
  const set = (id, n) => ($(id).textContent = n ? String(n) : "");
  set("countRequestHeaders", effectiveHeaders(p.requestHeaders).length);
  set("countResponseHeaders", effectiveHeaders(p.responseHeaders).length);
  set("countUrlFilters", p.urlFilters.filter((f) => f.enabled && f.pattern.trim()).length);
}

function headerRow(r, list) {
  const row = document.createElement("div");
  row.className = "row" + (r.enabled ? "" : " disabled");

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = r.enabled;
  cb.title = t("enableRow");
  cb.addEventListener("change", () => { r.enabled = cb.checked; row.classList.toggle("disabled", !r.enabled); renderCounts(); saveNow(); });

  const name = document.createElement("input");
  name.type = "text";
  name.className = "name";
  name.placeholder = t("namePlaceholder");
  name.value = r.name;
  name.setAttribute("list", "commonHeaders");
  name.spellcheck = false;

  const value = document.createElement("input");
  value.type = "text";
  value.className = "value";
  value.placeholder = t("valuePlaceholder");
  value.value = r.value;
  value.spellcheck = false;

  const validate = () => {
    const n = name.value.trim();
    const badName = n !== "" && !isValidHeaderName(n);
    name.classList.toggle("invalid", badName);
    name.title = badName ? t("invalidName") : "";
    const badValue = !isValidHeaderValue(value.value);
    value.classList.toggle("invalid", badValue);
    value.title = badValue ? t("invalidValue") : value.value === "" && n ? t("emptyRemoves") : "";
  };
  name.addEventListener("input", () => { r.name = name.value; validate(); renderCounts(); saveSoon(); });
  value.addEventListener("input", () => { r.value = value.value; validate(); saveSoon(); });
  validate();

  row.append(cb, name, value, deleteButton(r, list));
  return row;
}

function filterRow(r, list) {
  const row = document.createElement("div");
  row.className = "row" + (r.enabled ? "" : " disabled");

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = r.enabled;
  cb.addEventListener("change", () => { r.enabled = cb.checked; row.classList.toggle("disabled", !r.enabled); renderCounts(); saveNow(); });

  const pat = document.createElement("input");
  pat.type = "text";
  pat.className = "pattern";
  pat.placeholder = t("filterPlaceholder");
  pat.value = r.pattern;
  pat.spellcheck = false;
  pat.addEventListener("input", () => { r.pattern = pat.value; renderCounts(); saveSoon(); });

  row.append(cb, pat, deleteButton(r, list));
  return row;
}

function deleteButton(r, list) {
  const del = document.createElement("button");
  del.className = "del";
  del.textContent = "×";
  del.title = t("deleteRow");
  del.addEventListener("click", () => {
    const i = list.indexOf(r);
    if (i >= 0) list.splice(i, 1);
    renderRows(); renderCounts(); saveNow();
  });
  return del;
}

function renderRows() {
  const p = activeProfile(state);
  const list = p[tab];
  const box = $("rows");
  box.innerHTML = "";
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const hints = { requestHeaders: "hintRequest", responseHeaders: "hintResponse", urlFilters: "hintFilters" };
  $("tabHint").textContent = t(hints[tab]);
  $("addRow").textContent = tab === "urlFilters" ? t("addFilter") : t("addHeader");
  $("addRow").disabled = list.length >= MAX_ROWS;
  for (const r of list) box.appendChild(tab === "urlFilters" ? filterRow(r, list) : headerRow(r, list));
}

async function renderStatus() {
  const got = await chrome.storage.local.get("hh_status");
  const err = got.hh_status && got.hh_status.error;
  const banner = $("errorBanner");
  if (!err) { banner.hidden = true; return; }
  banner.hidden = false;
  banner.textContent = err.startsWith("regex:") ? t("badRegex", [err.slice(6)]) : t("applyError", [err]);
}

function renderAll() {
  renderToggle(); renderProfiles(); renderCounts(); renderRows(); renderStatus();
}

function startRename() {
  const p = activeProfile(state);
  const sel = $("profileSelect");
  const input = document.createElement("input");
  input.type = "text";
  input.value = p.name;
  input.maxLength = 60;
  input.style.cssText = "flex:1;min-width:0;height:30px;padding:0 8px;border:1px solid var(--accent);border-radius:7px;background:var(--bg);color:var(--text);font:inherit";
  sel.replaceWith(input);
  input.focus(); input.select();
  let done = false;
  const finish = (commit) => {
    if (done) return; done = true;
    if (commit && input.value.trim()) { p.name = input.value.trim(); saveNow(); }
    input.replaceWith(sel);
    renderProfiles();
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") finish(true); if (e.key === "Escape") finish(false); });
  input.addEventListener("blur", () => finish(true));
}

async function init() {
  applyI18n();
  state = await loadState();
  renderAll();

  $("enabledToggle").addEventListener("change", (e) => { state.paused = !e.target.checked; renderToggle(); saveNow(); });
  $("profileSelect").addEventListener("change", (e) => { state.activeProfileId = e.target.value; renderAll(); saveNow(); });
  $("addProfile").addEventListener("click", () => {
    if (state.profiles.length >= MAX_PROFILES) return;
    const p = newProfile(t("profileN", [String(state.profiles.length + 1)]));
    state.profiles.push(p); state.activeProfileId = p.id; renderAll(); saveNow();
  });
  $("duplicateProfile").addEventListener("click", () => {
    if (state.profiles.length >= MAX_PROFILES) return;
    const src = activeProfile(state);
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid(); copy.name = t("copyOf", [src.name]);
    for (const k of ["requestHeaders", "responseHeaders", "urlFilters"]) copy[k].forEach((r) => (r.id = uid()));
    state.profiles.push(copy); state.activeProfileId = copy.id; renderAll(); saveNow();
  });
  $("renameProfile").addEventListener("click", startRename);
  $("deleteProfile").addEventListener("click", () => {
    if (state.profiles.length <= 1) return;
    const btn = $("deleteProfile");
    if (!deleteArmed) {
      deleteArmed = true; btn.textContent = "✓"; btn.title = t("confirmDelete");
      setTimeout(() => { deleteArmed = false; btn.textContent = "🗑"; btn.title = t("deleteProfile"); }, 2500);
      return;
    }
    deleteArmed = false; btn.textContent = "🗑";
    state.profiles = state.profiles.filter((p) => p.id !== state.activeProfileId);
    state.activeProfileId = state.profiles[0].id; renderAll(); saveNow();
  });
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; renderRows(); }));
  $("addRow").addEventListener("click", () => {
    const list = activeProfile(state)[tab];
    if (list.length >= MAX_ROWS) return;
    list.push(tab === "urlFilters" ? newFilter() : newHeader());
    renderRows(); saveNow();
    const inputs = $("rows").querySelectorAll('input[type="text"]');
    const target = tab === "urlFilters" ? inputs[inputs.length - 1] : inputs[inputs.length - 2];
    if (target) target.focus();
  });
  $("openOptions").addEventListener("click", (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.hh_status) renderStatus();
    // Another window (e.g. an import) changed the data: reload unless the user is typing here.
    if (changes[STORAGE_KEY] && !document.activeElement?.matches('input[type="text"]')) {
      loadState().then((s) => {
        if (JSON.stringify(s) !== JSON.stringify(state)) { state = s; renderAll(); }
      });
    }
  });
  window.addEventListener("pagehide", () => { if (saveTimer) saveNow(); });
}

init();
