import { Fragment } from "react";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import { useLiveKit } from "../contexts/livekitContext";
import { useTriviaSocket } from "../contexts/triviaSocketContext";
import type { TriviaBoard, TriviaLobbyState } from "../requests/trivia";

function isBoardComplete(
  board: TriviaBoard,
  mask: boolean[][] | undefined,
): boolean {
  if (board.CategoryPoints.length === 0 || board.Categories.length === 0) {
    return false;
  }
  return board.Categories.every((category, column) =>
    board.CategoryPoints.every((_, row) => {
      const field = category.Fields?.[row];
      if (!field?.Text) return true;
      return mask?.[row]?.[column] ?? false;
    }),
  );
}

export function TriviaAdminScreen({ state }: { state: TriviaLobbyState }) {
  const { userData } = useAuth();
  const { localization } = useLanguage();
  const { cameraId, microphoneId } = useLiveKit();
  const {
    adminBoard,
    nextRound,
    nextBoard,
    finishGame,
    selectCard,
    submitAnswer,
  } = useTriviaSocket();

  function openStreamView() {
    const params = new URLSearchParams();
    if (cameraId) {
      params.set("cameraId", cameraId);
    }
    if (microphoneId) {
      params.set("microphoneId", microphoneId);
    }
    const query = params.toString();
    window.open(
      `/game/trivia/ingame${query ? `?${query}` : ""}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const players = Object.values(state.players).filter(
    (player) =>
      player.uuid !== state.admin && player.uuid !== userData.uuid,
  );

  const boardId = state.currentBoardIdx;
  const board = adminBoard?.Boards?.[boardId];
  const categories = board?.Categories ?? [];
  const points = board?.CategoryPoints ?? [];
  const mask = state.gameState.boardMask[boardId];
  const gridColumns = `4rem repeat(${Math.max(categories.length, 1)}, minmax(4rem, 1fr))`;
  const currentPlayerId = state.playerOrder?.[state.currentPlayer];
  const hasCurrentPlayer = Boolean(currentPlayerId);
  const canSelectCard = state.phase === 1 && hasCurrentPlayer;
  const boardComplete = board ? isBoardComplete(board, mask) : false;
  const boards = adminBoard?.Boards ?? [];
  const allBoardsComplete =
    Boolean(adminBoard) &&
    boards.length > 0 &&
    boards.every((item, index) =>
      isBoardComplete(item, state.gameState.boardMask[index]),
    );
  const canAdvanceBoard =
    Boolean(adminBoard) &&
    boardComplete &&
    boardId + 1 < (adminBoard?.Boards.length ?? 0);
  const canNextRound = state.roundPointsAwarded;
  const phaseNames: Record<number, string> = {
    0: localization.lobby.l_phase_waiting,
    1: localization.lobby.l_phase_choice,
    2: localization.lobby.l_phase_buzz,
    3: localization.lobby.l_phase_answer,
    4: localization.lobby.l_phase_finished,
    5: localization.lobby.l_phase_scored,
  };
  const phaseName = phaseNames[state.phase] ?? String(state.phase);
  const boardTitle = board?.Title || `${localization.lobby.l_board} ${boardId + 1}`;

  return (
    <div className="AdminScreen">
      <div className="AdminBoardHeader">
        <div className="AdminBoardTitle">
          <h2>{boardTitle}</h2>
          <span className="AdminPhase">
            {localization.lobby.l_phase} {phaseName}
          </span>
        </div>
        <div className="AdminBoardActions">
          <button className="FunctionButton" type="button" onClick={openStreamView}>
            {localization.lobby.b_open_stream}
          </button>
          {allBoardsComplete ? (
            <button
            className="FunctionButton"
              type="button"
              onClick={finishGame}
              disabled={state.phase === 4}
            >
              {localization.lobby.b_finish_game}
            </button>
          ) : (
            <>{canAdvanceBoard ? <button
              className="FunctionButton"
                type="button"
                onClick={nextBoard}
                disabled={!canAdvanceBoard}
              >
                {localization.lobby.b_next_board}
              </button>:
                            <button
              className="FunctionButton"
                type="button"
                onClick={nextRound}
                disabled={!canNextRound}
              >
                {localization.lobby.b_next_round}
              </button>
              }

            </>
          )}
        </div>
      </div>

      {adminBoard ? (
        <div
          className="GameBoardGrid AdminBoard"
          style={{ gridTemplateColumns: gridColumns }}
        >
          <div
            className="GameHeader"
            style={{
              gridColumn: "1 / -1",
              gridTemplateColumns: gridColumns,
            }}
          >

            <div aria-hidden="true" />

            {categories.map((category) => (
              <div
                className="GameCategoryHeader"
                key={`category-${category.Uid}`}
              >
                {category.Name}
              </div>
            ))}
          </div>

          {points.map((point, row) => (
            <Fragment key={`row-${row}`}>
              <div className="GameCell AdminPointCell">{point}</div>

              {categories.map((category, column) => {
                const field = category.Fields?.[row];
                const used = mask?.[row]?.[column] ?? false;
                const selectable =
                  Boolean(field?.Text) && !used && canSelectCard;
                const question = state.gameState.currentQuestion;
                const current =
                  !state.roundPointsAwarded &&
                  question.index?.[0] === boardId &&
                  question.index?.[1] === column &&
                  question.index?.[2] === row;
                return (
                  <button
                    type="button"
                    className={`GameCell AdminQuestionCell${
                      used ? " used" : ""
                    }${current ? " current" : ""}`}
                    key={`cell-${category.Uid}-${row}`}
                    disabled={!selectable}
                    onClick={() => selectCard([boardId, column, row])}
                  >
                    {field?.Text}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      ) : (
        <p className="Subtitle">{localization.lobby.l_loading_board}</p>
      )}

      <h2>{localization.lobby.l_players}</h2>

      {players.length === 0 ? (
        <p className="Subtitle">{localization.lobby.l_no_opponents}</p>
      ) : (
        <ul className="AdminPlayers">
          {players.map((player) => {
            const buzzed = player.uuid === state.buzzPlayer;
            const canSubmitAnswer = buzzed && state.phase === 3;

            return (
              <li
                key={player.uuid}
                className={`AdminPlayer${
                  player.uuid === currentPlayerId ? " current" : ""
                }${buzzed ? " buzzed" : ""}`}
              >
                <span className="AdminPlayerName">{player.name}</span>
                <span className="AdminPlayerPoints">{player.points}</span>

                {canSubmitAnswer && (
                  <span className="AdminAnswerActions">
                    <button
                      type="button"
                      className="AdminAnswerButton correct"
                      onClick={() => submitAnswer(true)}
                    >
                      {localization.lobby.b_correct}
                    </button>
                    <button
                      type="button"
                      className="AdminAnswerButton incorrect"
                      onClick={() => submitAnswer(false)}
                    >
                      {localization.lobby.b_incorrect}
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
