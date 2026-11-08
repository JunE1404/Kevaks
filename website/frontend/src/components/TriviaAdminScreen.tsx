import { Fragment } from "react";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import { useTriviaSocket } from "../contexts/triviaSocketContext";
import type { TriviaLobbyState } from "../requests/trivia";

export function TriviaAdminScreen({ state }: { state: TriviaLobbyState }) {
  const { userData } = useAuth();
  const { localization } = useLanguage();
  const { adminBoard, nextRound, nextBoard, selectCard, submitAnswer } =
    useTriviaSocket();

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
  const canSelectCard = state.phase === 1;
  const boardComplete =
    points.length > 0 &&
    categories.length > 0 &&
    categories.every((category, column) =>
      points.every((_, row) => {
        const field = category.Fields?.[row];
        if (!field?.Text) return true;
        return mask?.[row]?.[column] ?? false;
      }),
    );
  const canAdvanceBoard =
    Boolean(adminBoard) &&
    boardComplete &&
    boardId + 1 < (adminBoard?.Boards.length ?? 0);
  const canNextRound = state.roundPointsAwarded;

  return (
    <div className="AdminScreen">
      <div className="AdminBoardHeader">
        <div className="AdminBoardTitle">
          <h2>{localization.lobby.l_board}</h2>
          <span className="AdminPhase">
            {localization.lobby.l_phase} {state.phase}
          </span>
        </div>
        <div className="AdminBoardActions">
          <button
            type="button"
            onClick={() =>
              window.open(
                "/game/trivia/ingame",
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            {localization.lobby.b_open_stream}
          </button>
          <button
            type="button"
            onClick={nextBoard}
            disabled={!canAdvanceBoard}
          >
            {localization.lobby.b_next_board}
          </button>
          <button
            type="button"
            onClick={nextRound}
            disabled={!canNextRound}
          >
            {localization.lobby.b_next_round}
          </button>
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
            <div className="GameBoardName">
              {board?.Title || adminBoard.Title}
            </div>

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
                return (
                  <button
                    type="button"
                    className={`GameCell AdminQuestionCell${
                      used ? " used" : ""
                    }`}
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
