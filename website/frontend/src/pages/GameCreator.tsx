import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/languageContext";
import { newGameConfig } from "../misc/trivia";
import {
  deleteTriviaGame,
  listTriviaGames,
  saveTriviaGame,
  startTriviaGame,
  type TriviaGameInfo,
} from "../requests/trivia";

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function GameCreator() {
  const { localization } = useLanguage();
  const navigate = useNavigate();

  const [games, setGames] = useState<TriviaGameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await listTriviaGames();
        if (active) setGames(data);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  async function createGame() {
    setCreating(true);
    setError(false);

    try {
      const result = await saveTriviaGame(newGameConfig());
      if (!result.ok) {
        setError(true);
        return;
      }
      navigate(`/games/trivia/create/${result.game.Uid}`);
    } catch {
      setError(true);
    } finally {
      setCreating(false);
    }
  }

  async function deleteGame(uuid: string) {
    setDeleting(uuid);
    setError(false);

    try {
      await deleteTriviaGame(uuid);
      setGames((previous) => previous.filter((game) => game.uuid !== uuid));
    } catch {
      setError(true);
    } finally {
      setDeleting(null);
    }
  }

  async function openLobby(uuid: string) {
    setStarting(uuid);
    setError(false);

    try {
      const created = await startTriviaGame(uuid);
      if (!created) {
        setError(true);
        return;
      }
      navigate("/games/trivia/lobby");
    } catch {
      setError(true);
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="PageContainer GameCreatorPage">
      <div className="EditorHeader">
        <h1>{localization.creator.l_title}</h1>
        <button type="button" onClick={createGame} disabled={creating}>
          {localization.creator.b_create}
        </button>
      </div>

      <Link to="/games">{localization.creator.b_back}</Link>

      {error && <p className="FormError">{localization.errors.generic}</p>}

      {loading ? (
        <p className="Subtitle">{localization.creator.l_loading}</p>
      ) : games.length === 0 ? (
        <p className="Subtitle">{localization.creator.l_empty}</p>
      ) : (
        <div className="GameGrid">
          {games.map((game) => (
            <div key={game.uuid} className="GameCard">
              <button
                type="button"
                className="GameCardOpen"
                onClick={() => navigate(`/games/trivia/create/${game.uuid}`)}
              >
                <span className="GameCardTitle">{game.title}</span>
                <span className="GameCardStatus">
                  {game.done
                    ? localization.creator.l_done
                    : localization.creator.l_in_progress}
                </span>
                <span className="Subtitle">
                  {new Date(game.lastUpdate).toLocaleString()}
                </span>
              </button>

              {game.done && (
                <button
                  type="button"
                  className="GameCardLobby"
                  onClick={() => void openLobby(game.uuid)}
                  disabled={starting === game.uuid}
                >
                  {localization.creator.b_open_lobby}
                </button>
              )}

              <button
                type="button"
                className="GameCardDelete"
                onClick={() => void deleteGame(game.uuid)}
                disabled={deleting === game.uuid}
                aria-label={localization.creator.b_delete}
                title={localization.creator.b_delete}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
