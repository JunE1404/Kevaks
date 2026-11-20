import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { CopyButton } from "../components/CopyButton";
import { useLanguage } from "../contexts/languageContext";
import { isValidName } from "../misc/helpers";
import type { ErrorCode } from "../requests/errors";
import {
  createAccount,
  listUsers,
  resetAccountPassword,
  setAccountEnabled,
  type AdminUser,
} from "../requests/admin";

type Result = {
  success: boolean;
  message: string;
  temporaryPassword?: string;
} | null;

export function Admin() {
  const { localization } = useLanguage();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyUuid, setBusyUuid] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [hideDisabled, setHideDisabled] = useState(false);

  async function refreshUsers() {
    try {
      setUsers(await listUsers());
    } catch {
      setUsers([]);
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await listUsers();
        if (active) setUsers(data);
      } catch {
        if (active) setUsers([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const nameErrorMessages: Record<ErrorCode, string> = {
    e20: localization.errors.e20,
    e21: localization.errors.e21,
    unknown: localization.errors.generic,
  };

  async function handleAdd(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    if (!isValidName(name)) {
      setResult({ success: false, message: localization.errors.e20 });
      return;
    }

    setBusy(true);
    try {
      const outcome = await createAccount(name, isAdmin, isDev);
      if (!outcome.ok) {
        setResult({ success: false, message: nameErrorMessages[outcome.code] });
        return;
      }
      setResult({
        success: true,
        message: localization.admin.l_success_add,
        temporaryPassword: outcome.account.temporary_password,
      });
      setName("");
      setIsAdmin(false);
      setIsDev(false);
      await refreshUsers();
    } catch {
      setResult({ success: false, message: localization.admin.l_failure });
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(user: AdminUser) {
    const nextEnabled = !user.enabled;
    setBusyUuid(user.uuid);
    setResult(null);

    try {
      await setAccountEnabled(user.uuid, nextEnabled);
      setResult({
        success: true,
        message: nextEnabled
          ? localization.admin.l_success_enable
          : localization.admin.l_success_disable,
      });
      await refreshUsers();
    } catch {
      setResult({ success: false, message: localization.admin.l_failure });
    } finally {
      setBusyUuid(null);
    }
  }

  async function resetUserPassword(user: AdminUser) {
    setBusyUuid(user.uuid);
    setResult(null);

    try {
      const reset = await resetAccountPassword(user.uuid);

      setResult({
        success: true,
        message: "Password reset for "+user.name+".",
        temporaryPassword: reset.temporary_password,
      });
      await refreshUsers();
    } catch {
      setResult({ success: false, message: localization.admin.l_failure });
    } finally {
      setBusyUuid(null);
    }
  }

  const visibleUsers = hideDisabled ? users.filter((user) => user.enabled) : users;

  return (
    <div className="PageContainer AdminPage">
      <h1>{localization.admin.l_title}</h1>

      <h2>{localization.admin.l_create_account}</h2>
      <form className="AdminForm" onSubmit={handleAdd}>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={localization.admin.l_name}
          required
        />
        <label className="AdminCheck">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(event) => setIsAdmin(event.target.checked)}
          />
          {localization.admin.l_admin}
        </label>
        <label className="AdminCheck">
          <input
            type="checkbox"
            checked={isDev}
            onChange={(event) => setIsDev(event.target.checked)}
          />
          {localization.admin.l_dev}
        </label>
        <button className="FunctionButton" type="submit" disabled={busy}>
          {localization.admin.b_submit}
        </button>
      </form>

      {result && (
        <div className={`AdminResult ${result.success ? "Success" : "Failure"}`}>
          <span>{result.message}</span>
          {result.temporaryPassword && (
            <span className="AdminTemp">
              {localization.admin.l_tmp_password}: <code>{result.temporaryPassword}</code>
              <CopyButton value={result.temporaryPassword} />
            </span>
          )}
        </div>
      )}

      {loading ? (
        <p className="Subtitle">{localization.admin.l_loading}</p>
      ) : (
        <>
          <label className="AdminCheck AdminToggle">
            <input
              type="checkbox"
              checked={hideDisabled}
              onChange={(event) => setHideDisabled(event.target.checked)}
            />
            {localization.admin.l_hide_disabled}
          </label>
          <table className="AdminTable">
          <thead>
            <tr>
              <th>{localization.admin.l_col_name}</th>
              <th>{localization.admin.l_col_role}</th>
              <th>{localization.admin.l_col_status}</th>
              <th>{localization.admin.l_col_temp}</th>
              <th>{localization.admin.l_col_last_login}</th>
              <th>{localization.admin.l_col_actions}</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user) => (
              <tr key={user.uuid}>
                <td>{user.name}</td>
                <td>{user.role}</td>
                <td>
                  {user.enabled ? localization.admin.l_enabled : localization.admin.l_disabled}
                </td>
                <td>{user.temp ? localization.admin.l_yes : localization.admin.l_no}</td>
                <td>
                  {user.last_login
                    ? new Date(user.last_login).toLocaleString()
                    : localization.admin.l_never}
                </td>
                <td>
                  <div className="AdminActions">
                    <button
                    className="FunctionButton"
                      type="button"
                      disabled={busyUuid === user.uuid}
                      onClick={() => {
                        void toggleEnabled(user);
                      }}
                    >
                      {user.enabled
                        ? localization.admin.b_disable
                        : localization.admin.b_enable}
                    </button>
                    <button
                    className="FunctionButton"
                      type="button"
                      disabled={busyUuid === user.uuid}
                      onClick={() => {
                        void resetUserPassword(user);
                      }}
                    >
                      {localization.admin.b_reset_password}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </>
      )}
    </div>
  );
}
