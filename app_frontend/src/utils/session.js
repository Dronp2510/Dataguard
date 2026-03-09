// session.js

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

function getStoredValue(key) {
  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue) return sessionValue;
  const localValue = localStorage.getItem(key);
  if (localValue) {
    sessionStorage.setItem(key, localValue);
    return localValue;
  }
  return null;
}

function clearSessionStorageKeys() {
  sessionStorage.removeItem("dg_user_id");
  sessionStorage.removeItem("dg_salt");
  sessionStorage.removeItem("dg_access_token");
  sessionStorage.removeItem("dg_session_expires_at");
  sessionStorage.removeItem("user");
}

function clearLegacyLocalStorageKeys() {
  localStorage.removeItem("dg_user_id");
  localStorage.removeItem("dg_salt");
  localStorage.removeItem("dg_access_token");
  localStorage.removeItem("user");
}

export function setSession({ user_id, salt, token, expires_at }) {
  const expiryIso = expires_at ? new Date(expires_at).toISOString() : null;

  sessionStorage.setItem("dg_user_id", user_id);
  sessionStorage.setItem("dg_salt", salt);
  sessionStorage.setItem("dg_access_token", token);
  localStorage.setItem("dg_user_id", user_id);
  localStorage.setItem("dg_salt", salt);
  localStorage.setItem("dg_access_token", token);
  if (expiryIso) {
    sessionStorage.setItem("dg_session_expires_at", expiryIso);
    localStorage.setItem("dg_session_expires_at", expiryIso);
  } else {
    sessionStorage.removeItem("dg_session_expires_at");
    localStorage.removeItem("dg_session_expires_at");
  }
  notifyAuthChanged();
}

export function getUserId() {
  return getStoredValue("dg_user_id");
}

export function getSalt() {
  return getStoredValue("dg_salt");
}

export function getAccessToken() {
  const token = getStoredValue("dg_access_token");
  if (!token) return null;
  const expiryIso = getStoredValue("dg_session_expires_at");
  if (!expiryIso) return token;
  const expiryTs = Date.parse(expiryIso);
  if (Number.isNaN(expiryTs) || Date.now() < expiryTs) return token;
  clearSession();
  return null;
}

export function clearSession() {
  clearSessionStorageKeys();
  clearLegacyLocalStorageKeys();
  sessionStorage.removeItem("dg_refresh_events");
  notifyAuthChanged();
}

export function isRapidRefreshDetected(maxRefreshes = 8, windowMs = 12000) {
  const key = "dg_refresh_events";
  let events = [];
  try {
    events = JSON.parse(sessionStorage.getItem(key) || "[]");
    if (!Array.isArray(events)) events = [];
  } catch {
    events = [];
  }
  const now = Date.now();
  const recent = events.filter((ts) => Number.isFinite(ts) && now - ts <= windowMs);
  recent.push(now);
  sessionStorage.setItem(key, JSON.stringify(recent.slice(-20)));
  return recent.length > maxRefreshes;
}
