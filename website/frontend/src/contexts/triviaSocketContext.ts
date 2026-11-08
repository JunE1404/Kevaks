import { createContext, useContext } from "react";
import type {
  TriviaCardIndex,
  TriviaGame,
  TriviaLobbyState,
} from "../requests/trivia";

export type TriviaSocketContextType = {
  gameState: TriviaLobbyState | null;
  adminBoard: TriviaGame | null;
  connected: boolean;
  error: string | null;
  startGame: () => void;
  nextRound: () => void;
  nextBoard: () => void;
  selectCard: (index: TriviaCardIndex) => void;
  submitAnswer: (correct: boolean) => void;
  buzz: () => void;
};

export const TriviaSocketContext = createContext<TriviaSocketContextType>({
  gameState: null,
  adminBoard: null,
  connected: false,
  error: null,
  startGame: () => {},
  nextRound: () => {},
  nextBoard: () => {},
  selectCard: () => {},
  submitAnswer: () => {},
  buzz: () => {},
});

export function useTriviaSocket() {
  return useContext(TriviaSocketContext);
}
