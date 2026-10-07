// Pro license check. Works offline: the key you type is hashed on this device and compared
// with the list below. Nothing is sent anywhere.
const PRO_HASHES = [
  "8a44ae598e7a50bc3bb9633e4b07cf50caf345a1535398c984ea3b49f9a76468"
];

export function normalizeKey(key) {
  return String(key || "").toUpperCase().replace(/[\s　]/g, "").replace(/[ー－–—]/g, "-");
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isPro(state) {
  const key = normalizeKey(state && state.proKey);
  if (!key) return false;
  return PRO_HASHES.includes(await sha256Hex(key));
}

// Where people can buy a key.
export const BUY_URL = "https://honest-tools.booth.pm/";
