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
  localStorage.removeItem("dg_session_expires_at");
  localStorage.removeItem("user");
}

export function setSession({ user_id, salt, token, expires_at }) {
  sessionStorage.setItem("dg_user_id", user_id);
  sessionStorage.setItem("dg_salt", salt);
  sessionStorage.setItem("dg_access_token", token);
  localStorage.setItem("dg_user_id", user_id);
  localStorage.setItem("dg_salt", salt);
  localStorage.setItem("dg_access_token", token);
  if (expires_at) {
    const normalized = new Date(expires_at).toISOString();
    sessionStorage.setItem("dg_session_expires_at", normalized);
    localStorage.setItem("dg_session_expires_at", normalized);
  } else {
    sessionStorage.removeItem("dg_session_expires_at");
    localStorage.removeItem("dg_session_expires_at");
  }
  notifyAuthChanged();
}

export function getUserId() {
  return sessionStorage.getItem("dg_user_id") || localStorage.getItem("dg_user_id");
}

export function getSalt() {
  return sessionStorage.getItem("dg_salt") || localStorage.getItem("dg_salt");
}

function getTokenFromStorage(storage) {
  const token = storage.getItem("dg_access_token");
  if (!token) return null;

  const expiryIso = storage.getItem("dg_session_expires_at");
  if (!expiryIso) return token;

  const expiryTs = Date.parse(expiryIso);
  if (Number.isNaN(expiryTs) || Date.now() < expiryTs) return token;
  return null;
}

export function getAccessToken() {
  const sessionToken = getTokenFromStorage(sessionStorage);
  if (sessionToken) {
    localStorage.setItem("dg_access_token", sessionToken);
    const sessionUserId = sessionStorage.getItem("dg_user_id");
    const sessionSalt = sessionStorage.getItem("dg_salt");
    const sessionExpiry = sessionStorage.getItem("dg_session_expires_at");
    if (sessionUserId) localStorage.setItem("dg_user_id", sessionUserId);
    if (sessionSalt) localStorage.setItem("dg_salt", sessionSalt);
    if (sessionExpiry) localStorage.setItem("dg_session_expires_at", sessionExpiry);
    return sessionToken;
  }

  const localToken = getTokenFromStorage(localStorage);
  if (localToken) {
    // Keep existing callers working by restoring the active token to this tab session.
    sessionStorage.setItem("dg_access_token", localToken);
    const userId = localStorage.getItem("dg_user_id");
    const salt = localStorage.getItem("dg_salt");
    const expiryIso = localStorage.getItem("dg_session_expires_at");
    if (userId) sessionStorage.setItem("dg_user_id", userId);
    if (salt) sessionStorage.setItem("dg_salt", salt);
    if (expiryIso) sessionStorage.setItem("dg_session_expires_at", expiryIso);
    return localToken;
  }

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
