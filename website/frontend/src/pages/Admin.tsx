import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { Link } from "react-router-dom";
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

type Mode = "add" | "status" | "reset";
type StatusAction = "enable" | "disable";

type Result = {
  success: boolean;
  message: string;
  temporaryPassword?: string;
} | null;

export function Admin() {
  const { localization } = useLanguage();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("add");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [statusUuid, setStatusUuid] = useState("");
  const [statusAction, setStatusAction] = useState<StatusAction>("enable");
  const [resetUuid, setResetUuid] = useState("");
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

  function switchMode(next: Mode) {
    setMode(next);
    setResult(null);
  }

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

  async function handleStatus(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);

    try {
      await setAccountEnabled(statusUuid, statusAction === "enable");
      setResult({
        success: true,
        message:
          statusAction === "enable"
            ? localization.admin.l_success_enable
            : localization.admin.l_success_disable,
      });
      setStatusUuid("");
      await refreshUsers();
    } catch {
      setResult({ success: false, message: localization.admin.l_failure });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);

    try {
      const reset = await resetAccountPassword(resetUuid);
      setResult({
        success: true,
        message: localization.admin.l_success_reset,
        temporaryPassword: reset.temporary_password,
      });
      setResetUuid("");
      await refreshUsers();
    } catch {
      setResult({ success: false, message: localization.admin.l_failure });
    } finally {
      setBusy(false);
    }
  }

  const visibleUsers = hideDisabled ? users.filter((user) => user.enabled) : users;

  return (
    <div className="PageContainer AdminPage">
      <h1>{localization.admin.l_title}</h1>
      <Link to="/home">{localization.admin.b_home}</Link>

      <div className="AdminModes">
        <button
          type="button"
          className={mode === "add" ? "active" : ""}
          onClick={() => switchMode("add")}
        >
          {localization.admin.l_mode_add}
        </button>
        <button
          type="button"
          className={mode === "status" ? "active" : ""}
          onClick={() => switchMode("status")}
        >
          {localization.admin.l_mode_status}
        </button>
        <button
          type="button"
          className={mode === "reset" ? "active" : ""}
          onClick={() => switchMode("reset")}
        >
          {localization.admin.l_mode_reset}
        </button>
      </div>

      {mode === "add" && (
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
          <button type="submit" disabled={busy}>
            {localization.admin.b_submit}
          </button>
        </form>
      )}

      {mode === "status" && (
        <form className="AdminForm" onSubmit={handleStatus}>
          <input
            type="text"
            value={statusUuid}
            onChange={(event) => setStatusUuid(event.target.value)}
            placeholder={localization.admin.l_uuid}
            required
          />
          <select
            value={statusAction}
            onChange={(event) => setStatusAction(event.target.value as StatusAction)}
          >
            <option value="enable">{localization.admin.l_enabled}</option>
            <option value="disable">{localization.admin.l_disabled}</option>
          </select>
          <button type="submit" disabled={busy}>
            {localization.admin.b_submit}
          </button>
        </form>
      )}

      {mode === "reset" && (
        <form className="AdminForm" onSubmit={handleReset}>
          <input
            type="text"
            value={resetUuid}
            onChange={(event) => setResetUuid(event.target.value)}
            placeholder={localization.admin.l_uuid}
            required
          />
          <button type="submit" disabled={busy}>
            {localization.admin.b_submit}
          </button>
        </form>
      )}

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
                  <CopyButton value={user.uuid} label={localization.admin.b_copy_uuid} />
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
