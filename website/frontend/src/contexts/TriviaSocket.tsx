import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./authContext";
import { useLanguage } from "./languageContext";
import { TriviaSocketContext } from "./triviaSocketContext";
import type {
  TriviaCardIndex,
  TriviaGame,
  TriviaLobbyState,
  TriviaSocketEvent,
} from "../requests/trivia";

function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/games/trivia/ws`;
}

const LOBBY_PATH = "/game/trivia/lobby";
const INGAME_PATH = "/game/trivia/ingame";
const ADMIN_PATH = "/game/trivia/admin";
const GAME_PATHS = new Set([INGAME_PATH, ADMIN_PATH]);

type SocketErrorData = { code?: string; message?: string };

export function TriviaSocketProvider() {
  const { userData } = useAuth();
  const { localization } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [gameState, setGameState] = useState<TriviaLobbyState | null>(null);
  const [adminBoard, setAdminBoard] = useState<TriviaGame | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const adminBoardRequested = useRef(false);
  const asAdmin = userData.admin || userData.dev;
  const genericError = localization.errors.generic;

  useEffect(() => {
    const socket = new WebSocket(socketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setError(null);
      adminBoardRequested.current = false;
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
        const data = event.data as SocketErrorData | undefined;
        const messageText = data?.message ?? genericError;
        if (data?.code === "join") {
          navigate("/games/trivia/error", {
            state: { message: messageText },
            replace: true,
          });
          return;
        }
        setError(messageText);
        return;
      }

      if (event.event === "admin_board") {
        const board = event.data as TriviaGame | undefined;
        if (board) setAdminBoard(board);
        return;
      }

      if (event.event === "b_update") {
        const state = event.data as TriviaLobbyState | undefined;
        if (state) setGameState(state);
      }

      if (
        event.event === "user_joined" ||
        event.event === "user_quit" ||
        event.event === "start" ||
        event.event === "b_update"
      ) {
        const state = event.data as TriviaLobbyState | undefined;
        if (state) setGameState(state);
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };

    socket.onerror = () => {
      setError(genericError);
    };

    return () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      socket.close();
    };
  }, [asAdmin, genericError, navigate]);

  useEffect(() => {
    if (!gameState) return;

    if (gameState.lobbyState === 0 && GAME_PATHS.has(location.pathname)) {
      navigate(LOBBY_PATH, { replace: true });
    } else if (
      gameState.lobbyState !== 0 &&
      location.pathname === LOBBY_PATH
    ) {
      const isOwner = gameState.admin === userData.uuid;
      navigate(isOwner ? ADMIN_PATH : INGAME_PATH, { replace: true });
    }
  }, [gameState, location.pathname, navigate, userData.uuid]);

  useEffect(() => {
    if (!connected || !gameState || adminBoardRequested.current) return;
    if (!location.pathname.endsWith("/admin")) return;
    if (gameState.admin !== userData.uuid) return;

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    adminBoardRequested.current = true;
    socket.send(JSON.stringify({ event: "request_admin_board" }));
  }, [connected, gameState, location.pathname, userData.uuid]);

  function sendEvent(event: string, data?: unknown) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(data === undefined ? { event } : { event, data }));
  }

  function startGame() {
    sendEvent("start");
  }

  function nextRound() {
    sendEvent("admin_init_choice_phase");
  }

  function nextBoard() {
    sendEvent("admin_next_board");
  }

  function selectCard(index: TriviaCardIndex) {
    sendEvent("admin_select_card", { index });
  }

  function submitAnswer(correct: boolean) {
    sendEvent("admin_submit_answer", { correct });
  }

  function buzz() {
    sendEvent("buzz");
  }

  return (
    <TriviaSocketContext.Provider
      value={{
        gameState,
        adminBoard,
        connected,
        error,
        startGame,
        nextRound,
        nextBoard,
        selectCard,
        submitAnswer,
        buzz,
      }}
    >
      <Outlet />
    </TriviaSocketContext.Provider>
  );
}
