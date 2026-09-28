import { useState } from "react";
import type { SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";

export function Login() {
  const { login, loading } = useAuth();
  const { localization } = useLanguage();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailed(false);

    const success = await login(name, password);
    if (success) {
      navigate("/home");
    } else {
      setFailed(true);
    }
  }

  return (
    <div className="PageContainer">
      <form className="LoginForm" onSubmit={handleSubmit}>
        <h1>{localization.login.l_title}</h1>

        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={localization.login.l_username}
          autoComplete="username"
          required
        />

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={localization.login.l_password}
          autoComplete="current-password"
          required
        />

        {failed && <p className="FormError">{localization.login.e_login_failed}</p>}

        <button type="submit" disabled={loading}>
          {localization.login.b_login}
        </button>
      </form>
    </div>
  );
}
