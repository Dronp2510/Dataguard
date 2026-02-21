// session.js

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

export function setSession({ user_id, salt, token }) {
  localStorage.setItem("dg_user_id", user_id);
  localStorage.setItem("dg_salt", salt);
  localStorage.setItem("dg_access_token", token);
  notifyAuthChanged();
}

export function getUserId() {
  return localStorage.getItem("dg_user_id");
}

export function getSalt() {
  return localStorage.getItem("dg_salt");
}

export function getAccessToken() {
  return localStorage.getItem("dg_access_token");
}

export function clearSession() {
  localStorage.removeItem("dg_user_id");
  localStorage.removeItem("dg_salt");
  localStorage.removeItem("dg_access_token");
  localStorage.removeItem("user");
  notifyAuthChanged();
}
