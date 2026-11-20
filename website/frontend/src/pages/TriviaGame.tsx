import { Link, useLocation } from "react-router-dom";
import { TriviaAdminScreen } from "../components/TriviaAdminScreen";
import { TriviaEndScreen } from "../components/TriviaEndScreen";
import { TriviaGameScreen } from "../components/TriviaGameScreen";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import { useTriviaSocket } from "../contexts/triviaSocketContext";

function HomeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function GameHomeButton({ label }: { label: string }) {
  return (
    <Link className="GameHome" to="/home" aria-label={label} title={label}>
      <HomeIcon />
    </Link>
  );
}

export function TriviaGame() {
  const { localization } = useLanguage();
  const { userData } = useAuth();
  const { gameState, error } = useTriviaSocket();
  const location = useLocation();

  const isAdminPath = location.pathname.endsWith("/admin");
  const isOwner = gameState?.admin === userData.uuid;

  if (!gameState) {
    return (
      <div className="PageContainer GamePage">
        <GameHomeButton label={localization.home.l_title} />
        <p className={error ? "FormError" : "Subtitle"}>
          {error ?? localization.lobby.l_connecting}
        </p>
      </div>
    );
  }

  if (gameState.lobbyState === 0) {
    return null;
  }

  if (isAdminPath && isOwner) {
    return (
      <div className="PageContainer GamePage">
        <GameHomeButton label={localization.home.l_title} />
        <h1 className="GameName">
          {gameState.title || localization.games.l_trivia}
        </h1>
        {error && <p className="FormError">{error}</p>}
        <TriviaAdminScreen state={gameState} />
      </div>
    );
  }

  if (gameState.phase === 4) {
    return (
      <div className="PageContainer GamePage">
        <GameHomeButton label={localization.home.l_title} />
        {error && <p className="FormError">{error}</p>}
        <TriviaEndScreen state={gameState} />
      </div>
    );
  }

  return (
    <div className="PageContainer GamePage">
      <GameHomeButton label={localization.home.l_title} />
      <h1 className="GameName">
        {gameState.title || localization.games.l_trivia}
      </h1>
      {error && <p className="FormError">{error}</p>}
      <TriviaGameScreen state={gameState} />
    </div>
  );
}
