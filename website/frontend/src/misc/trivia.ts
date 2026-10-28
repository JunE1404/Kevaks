import type { TriviaBoard, TriviaCategory, TriviaField, TriviaGame } from "../requests/trivia";

export function newUid(): string {
  return crypto.randomUUID();
}

export function emptyField(): TriviaField {
  return { Uid: newUid(), Type: "normal", Text: "", Answer: "", SpecialText: "" };
}

export function newCategory(index: number): TriviaCategory {
  return { Uid: newUid(), Name: `Category ${index}`, Fields: [] };
}

export function newBoard(index: number): TriviaBoard {
  return {
    Uid: newUid(),
    Title: `Board ${index}`,
    CategoryPoints: [100, 200, 300],
    Categories: [newCategory(1)],
  };
}

export function newGameConfig(): TriviaGame {
  return {
    Uid: newUid(),
    Title: "New game",
    Boards: [newBoard(1)],
  };
}
