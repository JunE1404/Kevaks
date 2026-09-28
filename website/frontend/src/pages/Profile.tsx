import { useState } from "react";
import type { SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import { isValidName } from "../misc/helpers";
import { changeName, type NameChangeError } from "../requests/auth";

export function Profile() {
  const { userData, logout, refreshUser } = useAuth();
  const { localization } = useLanguage();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<NameChangeError | null>(null);
  const [busy, setBusy] = useState(false);

  const errorMessages: Record<NameChangeError, string> = {
    e20: localization.errors.e20,
    e21: localization.errors.e21,
    unknown: localization.errors.generic,
  };

  function startEdit() {
    setName(userData.name);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setName(userData.name);
    setError(null);
    setEditing(false);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidName(name)) {
      setError("e20");
      return;
    }

    setBusy(true);
    const result = await changeName(name);
    setBusy(false);

    if (result) {
      setError(result);
      return;
    }

    await refreshUser();
    setError(null);
    setEditing(false);
  }

  return (
    <div className="PageContainer ProfilePage">
      <h1>{localization.profile.l_title}</h1>

      <form className="ProfileLine" onSubmit={handleSubmit}>
        <span className="ProfileLabel">{localization.profile.l_name}</span>
        {editing ? (
          <>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            <button type="button" onClick={cancel}>
              {localization.profile.b_cancel}
            </button>
            <button type="submit" disabled={busy}>
              {localization.profile.b_submit}
            </button>
          </>
        ) : (
          <>
            <span className="ProfileName">{userData.name}</span>
            <button type="button" onClick={startEdit}>
              {localization.profile.b_edit}
            </button>
          </>
        )}
      </form>

      {error && <p className="FormError">{errorMessages[error]}</p>}

      <div className="ProfileActions">
        {userData.admin && (
          <button type="button" onClick={() => navigate("/admin")}>
            {localization.admin.l_title}
          </button>
        )}
        <button type="button" onClick={() => logout()}>
          {localization.home.b_logout}
        </button>
      </div>
    </div>
  );
}
