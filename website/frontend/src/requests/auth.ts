export interface AuthUser {
  uuid: string;
  name: string;
  admin: boolean;
  dev: boolean;
  temp: boolean;
}

const API_BASE = "/api";

export async function login(name: string, password: string): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, password }),
  });

  if (!res.ok) {
    return null;
  }
  return res.json() as Promise<AuthUser>;
}

export async function autoLogin(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    return null;
  }
  return res.json() as Promise<AuthUser>;
}

export async function logout(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/logout`, {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
}

export async function resetPassword(password: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  return res.ok;
}
