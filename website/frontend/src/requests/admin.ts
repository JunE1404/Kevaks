import { readErrorCode, type ErrorCode } from "./errors";

export interface AdminUser {
  uuid: string;
  name: string;
  admin: boolean;
  dev: boolean;
  enabled: boolean;
  temp: boolean;
  last_login: string | null;
  role: string;
}

export interface AccountResult {
  uuid: string;
  name: string;
  temporary_password: string;
}

const API_BASE = "/api";

export async function listUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${API_BASE}/admin/accounts`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load users");
  }
  return res.json() as Promise<AdminUser[]>;
}

export type CreateAccountResult =
  | { ok: true; account: AccountResult }
  | { ok: false; code: ErrorCode };

export async function createAccount(
  name: string,
  admin: boolean,
  dev: boolean,
): Promise<CreateAccountResult> {
  const res = await fetch(`${API_BASE}/admin/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, admin, dev }),
  });

  if (!res.ok) {
    return { ok: false, code: await readErrorCode(res) };
  }
  return { ok: true, account: (await res.json()) as AccountResult };
}

export async function setAccountEnabled(uuid: string, enabled: boolean): Promise<void> {
  const action = enabled ? "enable" : "disable";
  const res = await fetch(`${API_BASE}/admin/accounts/${uuid}/${action}`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to update account");
  }
}

export async function resetAccountPassword(uuid: string): Promise<AccountResult> {
  const res = await fetch(`${API_BASE}/admin/accounts/${uuid}/pw-reset`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to reset password");
  }
  return res.json() as Promise<AccountResult>;
}
