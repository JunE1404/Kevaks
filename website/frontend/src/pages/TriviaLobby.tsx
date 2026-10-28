import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import type {
  TriviaLobbyPlayer,
  TriviaLobbyState,
  TriviaSocketEvent,
} from "../requests/trivia";

function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/games/trivia/ws`;
}

export function TriviaLobby() {
  const { userData } = useAuth();
  const { localization } = useLanguage();

  const [title, setTitle] = useState("");
  const [players, setPlayers] = useState<TriviaLobbyPlayer[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asAdmin = userData.admin || userData.dev;
  const genericError = localization.errors.generic;

  useEffect(() => {
    const socket = new WebSocket(socketUrl());

    socket.onopen = () => {
      setConnected(true);
      setError(null);
      socket.send(
        JSON.stringify({ event: "join", data: { asAdmin } }),
      );
    };

    socket.onmessage = (message) => {
      if (typeof message.data !== "string") return;

      let event: TriviaSocketEvent;
      try {
        event = JSON.parse(message.data) as TriviaSocketEvent;
      } catch {
        return;
      }

      if (event.event === "error") {
        const data = event.data as { message?: string } | undefined;
        setError(data?.message ?? genericError);
        return;
      }

      if (event.event === "user_joined" || event.event === "user_quit") {
        const state = event.data as TriviaLobbyState | undefined;
        if (!state) return;
        setTitle(state.title);
        setPlayers(Object.values(state.players));
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };

    socket.onerror = () => {
      setError(genericError);
    };

    return () => {
      socket.close();
    };
  }, [asAdmin, genericError]);

  const uniquePlayers = [
    ...new Map(players.map((player) => [player.uuid, player])).values(),
  ];

  return (
    <div className="PageContainer LobbyPage">
      <div className="EditorHeader">
        <h1>{title || localization.games.l_trivia}</h1>
        <Link className="LinkButton" to="/games">
          {localization.games.b_back}
        </Link>
      </div>

      {error && <p className="FormError">{error}</p>}
      {!connected && !error && (
        <p className="Subtitle">{localization.lobby.l_connecting}</p>
      )}

      {connected && (
        <>
          <h2>{localization.lobby.l_players}</h2>
          {uniquePlayers.length === 0 ? (
            <p className="Subtitle">{localization.lobby.l_empty}</p>
          ) : (
            <ul className="LobbyPlayers">
              {uniquePlayers.map((player) => (
                <li key={player.uuid} className="LobbyPlayer">
                  <code>{player.uuid}</code>
                  {player.admin && (
                    <span className="LobbyAdmin">
                      {localization.lobby.l_admin}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
