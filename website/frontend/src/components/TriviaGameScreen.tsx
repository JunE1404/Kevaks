import { Fragment } from "react";
import { AudioTrackView, VideoTrackView } from "./LiveKitMedia";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import { useLiveKit } from "../contexts/livekitContext";
import { useTriviaSocket } from "../contexts/triviaSocketContext";
import type { TriviaLobbyPlayer, TriviaLobbyState } from "../requests/trivia";

function CameraTile({
  player,
  host = false,
  current = false,
  buzzed = false,
  isSelf = false,
}: {
  player: TriviaLobbyPlayer;
  host?: boolean;
  current?: boolean;
  buzzed?: boolean;
  isSelf?: boolean;
}) {
  const { localization } = useLanguage();
  const {
    roomIdentities,
    videoTrackFor,
    audioTrackFor,
    cameraEnabled,
    microphoneEnabled,
    toggleCamera,
    toggleMicrophone,
  } = useLiveKit();

  const inRoom =
    Boolean(player.livekitIdentity) &&
    roomIdentities.includes(player.livekitIdentity);
  const videoTrack = inRoom ? videoTrackFor(player.livekitIdentity) : null;
  const audioTrack =
    inRoom && !isSelf ? audioTrackFor(player.livekitIdentity) : null;
  const showVideo = Boolean(videoTrack) && (!isSelf || cameraEnabled);

  const className = [
    "CameraTile",
    host ? "host" : "",
    isSelf ? "self" : "",
    current ? "current" : "",
    buzzed ? "buzzed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {showVideo && videoTrack && (
        <VideoTrackView track={videoTrack} muted={isSelf} mirrored={isSelf} />
      )}
      {audioTrack && <AudioTrackView track={audioTrack} />}

      <span className="CameraName">{player.name}</span>
      <span className="CameraPoints">{player.points}</span>

      {isSelf && (
        <div className="CameraControls">
          <button
            type="button"
            onClick={() => {
              void toggleMicrophone();
            }}
          >
            {microphoneEnabled
              ? localization.lobby.b_mute
              : localization.lobby.b_unmute}
          </button>
          <button
            type="button"
            onClick={() => {
              void toggleCamera();
            }}
          >
            {cameraEnabled
              ? localization.lobby.b_camera_off
              : localization.lobby.b_camera_on}
          </button>
        </div>
      )}
    </div>
  );
}

export function TriviaGameScreen({ state }: { state: TriviaLobbyState }) {
  const { userData } = useAuth();
  const { localization } = useLanguage();
  const { room } = useLiveKit();
  const { buzz } = useTriviaSocket();

  const players = Object.values(state.players).filter(
    (player) => player.connected,
  );
  const host = players.find((player) => player.uuid === state.admin);
  const others = players.filter((player) => player.uuid !== state.admin);

  const pickPlayers = (indices: number[]) =>
    indices
      .map((index) => others[index])
      .filter((player): player is TriviaLobbyPlayer => Boolean(player));

  const leftPlayers = pickPlayers([0, 2, 4, 6]);
  const rightPlayers = pickPlayers([1, 3, 5, 7]);

  const currentPlayerId = state.playerOrder?.[state.currentPlayer];
  const question = state.gameState.currentQuestion;
  const showQuestion = state.phase >= 2 && question.index !== null;
  const isHost = state.admin === userData.uuid;

  const board = state.boards?.[state.currentBoardIdx];
  const categories = board?.categories ?? [];
  const points = board?.categoryPoints ?? [];
  const mask = state.gameState.boardMask[state.currentBoardIdx];

  return (
    <div
      className="GameScreen"
      onClick={() => {
        void room?.startAudio();
      }}
    >
      <div className="GameLayout">
        <div className="CameraColumn left">
          {leftPlayers.map((player, index) => (
            <CameraTile
              key={`left-${index}`}
              player={player}
              current={player.uuid === currentPlayerId}
              buzzed={player.uuid === state.buzzPlayer}
              isSelf={player.uuid === userData.uuid}
            />
          ))}
        </div>

        <div className="PlayField">
          {showQuestion ? (
            <div className="QuestionView">
              <div className="QuestionMeta">
                <span className="QuestionValue">{question.value}</span>
                {state.freeForAll && (
                  <span className="QuestionFreeForAll">
                    {localization.lobby.l_free_for_all}
                  </span>
                )}
                {question.special && question.specialString && (
                  <span className="QuestionSpecial">
                    {question.specialString}
                  </span>
                )}
              </div>
              <p className="QuestionText">{question.question}</p>
              {!isHost && (
                <button
                  type="button"
                  className="BuzzButton"
                  onClick={buzz}
                  disabled={state.phase !== 2}
                >
                  {localization.lobby.b_buzz}
                </button>
              )}
            </div>
          ) : (
            <div
              className="GameBoardGrid"
              style={{
                gridTemplateColumns: `repeat(${Math.max(categories.length, 1)}, minmax(4rem, 1fr))`,
              }}
            >
              <div
                className="GameHeader"
                style={{
                  gridColumn: "1 / -1",
                  gridTemplateColumns: `repeat(${Math.max(categories.length, 1)}, minmax(4rem, 1fr))`,
                }}
              >
                <div className="GameBoardName">
                  {board?.title || state.title}
                </div>

                {categories.map((category, index) => (
                  <div
                    className="GameCategoryHeader"
                    key={`category-${index}`}
                  >
                    {category}
                  </div>
                ))}
              </div>

              {points.map((point, row) => (
                <Fragment key={`row-${row}`}>
                  {categories.map((_, column) => {
                    const used = mask?.[row]?.[column] ?? false;
                    return (
                      <div
                        className={`GameCell${used ? " used" : ""}`}
                        key={`cell-${row}-${column}`}
                      >
                        {point}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          )}

          {host && (
            <div className="HostRow">
              <CameraTile
                player={host}
                host
                current={host.uuid === currentPlayerId}
                buzzed={host.uuid === state.buzzPlayer}
                isSelf={host.uuid === userData.uuid}
              />
            </div>
          )}
        </div>

        <div className="CameraColumn right">
          {rightPlayers.map((player, index) => (
            <CameraTile
              key={`right-${index}`}
              player={player}
              current={player.uuid === currentPlayerId}
              buzzed={player.uuid === state.buzzPlayer}
              isSelf={player.uuid === userData.uuid}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
