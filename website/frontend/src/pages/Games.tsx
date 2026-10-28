import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import { getActiveTriviaLobby } from "../requests/trivia";

export function Games() {
  const { userData } = useAuth();
  const { localization } = useLanguage();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [activeLobby, setActiveLobby] = useState(false);

  const isCreator = userData.admin || userData.dev;

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const live = await getActiveTriviaLobby();
        if (active) setActiveLobby(live);
      } catch {
        if (active) setActiveLobby(false);
      }
    }

    check();

    return () => {
      active = false;
    };
  }, []);

  function openTrivia() {
    setError(null);

    if (isCreator) {
      navigate("/games/trivia/create");
      return;
    }

    if (activeLobby) {
      navigate("/games/trivia/lobby");
      return;
    }

    setError(localization.games.e_no_lobby);
  }

  return (
    <div className="PageContainer GamesPage">
      <h1>{localization.games.l_title}</h1>
      {error && <p className="FormError">{error}</p>}

      <div className="GameGrid">
        <button type="button" className="GameCard" onClick={openTrivia}>
          <span className="GameCardTitle">{localization.games.l_trivia}</span>
          <span
            className={`GameCardStatus ${activeLobby ? "Live" : "Offline"}`}
          >
            <span className="LiveDot" />
            {activeLobby
              ? localization.games.l_live
              : localization.games.l_offline}
          </span>
        </button>
      </div>
    </div>
  );
}
