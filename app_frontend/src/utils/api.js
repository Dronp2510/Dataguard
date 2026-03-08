import { clearSession, getAccessToken } from "./session";
import { clearMasterKey } from "./keyStore";

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "/api";

export async function apiFetch(path, options = {}) {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${API_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearMasterKey();
    clearSession();
  }

  return response;
}
