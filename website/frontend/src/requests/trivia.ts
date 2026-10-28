const API_BASE = "/api";

// These mirror the Go structs in types/types.go, which have no JSON tags, so
// the keys are the exported Go field names.
export interface TriviaField {
  Uid: string;
  Type: "normal" | "special";
  Text: string;
  Answer: string;
  SpecialText: string;
}

export interface TriviaCategory {
  Uid: string;
  Name: string;
  Fields: TriviaField[];
}

export interface TriviaBoard {
  Uid: string;
  Title: string;
  CategoryPoints: number[];
  Categories: TriviaCategory[];
}

export interface TriviaGame {
  Uid: string;
  Owner?: string;
  Title: string;
  Done?: boolean;
  Boards: TriviaBoard[];
}

// Returned by ListTriviaGames, which uses JSON tags.
export interface TriviaGameInfo {
  uuid: string;
  title: string;
  done: boolean;
  lastUpdate: string;
}

export interface TriviaLobbyPlayer {
  uuid: string;
  admin: boolean;
}

// The live game snapshot broadcast by the hub. Mirrors games/trivia.Game.
export interface TriviaLobbyState {
  lobbyState: number;
  gameState: {
    boardId: number;
    boardMask: boolean[][][];
    currentQuestion: {
      special: boolean;
      question: string;
      specialString: string;
    };
  };
  admin: string;
  players: Record<string, TriviaLobbyPlayer>;
  title: string;
}

export interface TriviaSocketEvent {
  event: string;
  uid?: string;
  data?: unknown;
}

export type TriviaErrorCode = "e30" | "e31" | "e32" | "unknown";

async function readTriviaErrorCode(res: Response): Promise<TriviaErrorCode> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error === "e30" || data.error === "e31" || data.error === "e32") {
      return data.error;
    }
  } catch {
    // malformed or empty body
  }
  return "unknown";
}

export async function listTriviaGames(): Promise<TriviaGameInfo[]> {
  const res = await fetch(`${API_BASE}/games/trivia`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load trivia games");
  }
  return res.json() as Promise<TriviaGameInfo[]>;
}

export async function getTriviaGame(uuid: string): Promise<TriviaGame> {
  const res = await fetch(`${API_BASE}/games/trivia/${uuid}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load trivia game");
  }
  return res.json() as Promise<TriviaGame>;
}

export async function deleteTriviaGame(uuid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/games/trivia/delete/${uuid}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to delete trivia game");
  }
}

export async function startTriviaGame(uuid: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/games/trivia/start/${uuid}`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to start trivia game");
  }
  return res.json() as Promise<boolean>;
}

export async function getActiveTriviaLobby(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/games/trivia/getactivelobby`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to check active trivia lobby");
  }
  return res.json() as Promise<boolean>;
}

export type SaveTriviaResult =
  | { ok: true; game: TriviaGame }
  | { ok: false; code: TriviaErrorCode };

export async function saveTriviaGame(game: TriviaGame): Promise<SaveTriviaResult> {
  const res = await fetch(`${API_BASE}/games/trivia`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(game),
  });

  if (!res.ok) {
    return { ok: false, code: await readTriviaErrorCode(res) };
  }
  return { ok: true, game: (await res.json()) as TriviaGame };
}
