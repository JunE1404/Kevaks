import { useState } from "react";
import type { SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import { validatePasswordForm, type PasswordFormError } from "../misc/helpers";
import { resetPassword } from "../requests/auth";

export function ResetPassword() {
  const { refreshUser } = useAuth();
  const { localization } = useLanguage();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [failed, setFailed] = useState(false);

  const error = validatePasswordForm(password, repeat);
  const canSubmit = error === null;

  const errorMessages: Record<PasswordFormError, string> = {
    empty: "",
    length: localization.password.e_length,
    special: localization.password.e_special,
    characters: localization.password.e_characters,
    mismatch: localization.password.e_mismatch,
  };

  const message = error && error !== "empty" ? errorMessages[error] : "";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setFailed(false);
    const success = await resetPassword(password);
    if (success) {
      await refreshUser();
      navigate("/home");
    } else {
      setFailed(true);
    }
  }

  return (
    <div className="PageContainer">
      <form className="LoginForm" onSubmit={handleSubmit}>
        <h1>{localization.password.l_title}</h1>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={localization.password.l_password}
          autoComplete="new-password"
          required
        />

        <input
          type="password"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
          placeholder={localization.password.l_repeat}
          autoComplete="new-password"
          required
        />

        {message && <p className="FormError">{message}</p>}
        {failed && <p className="FormError">{localization.errors.generic}</p>}

        <button type="submit" disabled={!canSubmit}>
          {localization.password.b_submit}
        </button>
      </form>
    </div>
  );
}
