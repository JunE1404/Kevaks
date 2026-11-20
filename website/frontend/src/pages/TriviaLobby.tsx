import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { CameraSettings } from "../components/CameraSettings";
import { VideoTrackView } from "../components/LiveKitMedia";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import { useLiveKit } from "../contexts/livekitContext";
import { useTriviaSocket } from "../contexts/triviaSocketContext";

export function TriviaLobby() {
  const { userData } = useAuth();
  const { localization } = useLanguage();
  const liveKit = useLiveKit();
  const { gameState, connected, error, startGame } = useTriviaSocket();
  const setupStarted = useRef(false);

  const isOwner = gameState?.admin === userData.uuid;
  const lobbyState = gameState?.lobbyState ?? 0;

  useEffect(() => {
    if (!connected || setupStarted.current) {
      return;
    }
    setupStarted.current = true;
    void liveKit.setupLocalTracks();
  }, [connected, liveKit]);

  if (lobbyState !== 0) return null;

  const title = gameState?.title ?? "";
  const connectedPlayers = gameState
    ? Object.values(gameState.players).filter((player) => player.connected)
    : [];

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
          <h2>{localization.lobby.l_camera}</h2>
          <div className="LobbyCamera">
            <div className="LobbyCameraPreview">
              {liveKit.localCameraTrack && liveKit.cameraEnabled ? (
                <VideoTrackView
                  track={liveKit.localCameraTrack}
                  muted
                  mirrored
                />
              ) : (
                <span className="Subtitle">
                  {localization.lobby.l_camera_off}
                </span>
              )}
            </div>

            <CameraSettings />
          </div>

          <h2>{localization.lobby.l_players}</h2>
          {connectedPlayers.length === 0 ? (
            <p className="Subtitle">{localization.lobby.l_empty}</p>
          ) : (
            <ul className="LobbyPlayers">
              {connectedPlayers.map((player) => (
                <li key={player.uuid} className="LobbyPlayer">
                  <code>{player.name}</code>
                  {player.admin && (
                    <span className="LobbyAdmin">
                      {localization.lobby.l_admin}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isOwner && (
            <button className="FunctionButton" type="button" onClick={startGame}>
              {localization.lobby.b_start}
            </button>
          )}
        </>
      )}
    </div>
  );
}
