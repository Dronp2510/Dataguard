// session.js

export function setSession({ user_id, salt }) {
  localStorage.setItem("dg_user_id", user_id);
  localStorage.setItem("dg_salt", salt);
}

export function getUserId() {
  return localStorage.getItem("dg_user_id");
}

export function getSalt() {
  return localStorage.getItem("dg_salt");
}

export function clearSession() {
  localStorage.removeItem("dg_user_id");
  localStorage.removeItem("dg_salt");
}
