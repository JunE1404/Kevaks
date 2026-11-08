import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../contexts/languageContext";

type ErrorState = { message?: string } | null;

export function TriviaError() {
  const { localization } = useLanguage();
  const location = useLocation();
  const message = (location.state as ErrorState)?.message;

  return (
    <div className="PageContainer LobbyPage">
      <h1>{localization.lobby.l_error_title}</h1>
      <p className="FormError">{message || localization.errors.generic}</p>
      <Link className="LinkButton" to="/games">
        {localization.games.b_back}
      </Link>
    </div>
  );
}
