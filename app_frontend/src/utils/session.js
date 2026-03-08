// session.js

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
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
  sessionStorage.setItem("dg_user_id", user_id);
  sessionStorage.setItem("dg_salt", salt);
  sessionStorage.setItem("dg_access_token", token);
  if (expires_at) {
    sessionStorage.setItem("dg_session_expires_at", new Date(expires_at).toISOString());
  }
  notifyAuthChanged();
}

export function getUserId() {
  return sessionStorage.getItem("dg_user_id");
}

export function getSalt() {
  return sessionStorage.getItem("dg_salt");
}

export function getAccessToken() {
  const token = sessionStorage.getItem("dg_access_token");
  if (!token) return null;
  const expiryIso = sessionStorage.getItem("dg_session_expires_at");
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
