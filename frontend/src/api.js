const BASE = (import.meta.env.VITE_API_URL || "") + "/api";

function getToken() {
  return localStorage.getItem("fitgeo_token");
}

function setToken(token) {
  localStorage.setItem("fitgeo_token", token);
}

function clearToken() {
  localStorage.removeItem("fitgeo_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return null;
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function register(profile) {
  const { password, ...rest } = profile;
  const body = password ? { ...rest, password } : rest;
  const data = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
  setToken(data.token);
  return data;
}

export async function login(name, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ name, password: password ?? null }),
  });
  setToken(data.token);
  return data;
}

export async function getState() {
  return request("/state");
}

export async function saveState(state) {
  return request("/state", {
    method: "PUT",
    body: JSON.stringify(state),
  });
}

export async function get(path) {
  return request(path);
}

export async function del(path) {
  return request(path, { method: "DELETE" });
}

export async function put(path, body) {
  return request(path, { method: "PUT", body: JSON.stringify(body) });
}

export async function post(path, body) {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}

export { getToken, clearToken };
