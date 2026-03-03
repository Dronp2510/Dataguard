// keyStore.js

let masterKey = null;

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// Save key in memory + sessionStorage (persists through refresh in same tab).
export async function setMasterKey(key) {
  masterKey = key;
  const raw = await crypto.subtle.exportKey("raw", key);
  sessionStorage.setItem("dg_master_key", bufToBase64(raw));
}

// Restore key after refresh in same tab session.
export async function restoreMasterKey() {
  const stored = sessionStorage.getItem("dg_master_key");
  if (!stored) return null;

  try {
    const raw = base64ToBuf(stored);
    masterKey = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
    return masterKey;
  } catch {
    sessionStorage.removeItem("dg_master_key");
    masterKey = null;
    return null;
  }
}

export function getMasterKey() {
  return masterKey;
}

export function clearMasterKey() {
  masterKey = null;
  sessionStorage.removeItem("dg_master_key");
}
