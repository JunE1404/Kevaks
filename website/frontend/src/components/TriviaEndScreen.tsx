import { useId } from "react";
import { MediaControls } from "./MediaControls";
import { AudioTrackView, VideoTrackView } from "./LiveKitMedia";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import { useLiveKit } from "../contexts/livekitContext";
import { usePlayerVolume } from "../utils/playerVolume";
import type { TriviaLobbyPlayer, TriviaLobbyState } from "../requests/trivia";

function EndCamera({
  player,
  isSelf = false,
}: {
  player: TriviaLobbyPlayer;
  isSelf?: boolean;
}) {
  const { localization } = useLanguage();
  const { roomIdentities, videoTrackFor, audioTrackFor } = useLiveKit();
  const [volume, setVolume] = usePlayerVolume(player.uuid);
  const volumeId = useId();

  const inRoom =
    Boolean(player.livekitIdentity) &&
    roomIdentities.includes(player.livekitIdentity);
  const videoTrack = inRoom ? videoTrackFor(player.livekitIdentity) : null;
  // Never attach our own microphone to a media element, it would echo.
  const audioTrack =
    inRoom && !isSelf ? audioTrackFor(player.livekitIdentity) : null;

  return (
    <div className="EndCamera">
      {videoTrack && (
        <VideoTrackView track={videoTrack} muted={isSelf} mirrored={isSelf} />
      )}
      {audioTrack && <AudioTrackView track={audioTrack} volume={volume} />}

      {audioTrack && (
        <div className="VolumeControl">
          <label className="VolumeLabel" htmlFor={volumeId}>
            {localization.lobby.l_volume}
          </label>
          <input
            className="VolumeSlider"
            id={volumeId}
            type="range"
            name="volume"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>
      )}

      <span className="CameraName">{player.name}</span>
    </div>
  );
}

/**
 * Audio-only participant for players ranked below the podium. They have no
 * tile on this screen, but must still be audible.
 */
function EndAudio({
  player,
  isSelf = false,
}: {
  player: TriviaLobbyPlayer;
  isSelf?: boolean;
}) {
  const { roomIdentities, audioTrackFor } = useLiveKit();
  const [volume] = usePlayerVolume(player.uuid);
  const inRoom =
    Boolean(player.livekitIdentity) &&
    roomIdentities.includes(player.livekitIdentity);
  const audioTrack =
    inRoom && !isSelf ? audioTrackFor(player.livekitIdentity) : null;

  if (!audioTrack) {
    return null;
  }
  return <AudioTrackView track={audioTrack} volume={volume} />;
}

export function TriviaEndScreen({ state }: { state: TriviaLobbyState }) {
  const { userData } = useAuth();
  const { room } = useLiveKit();

  const players = Object.values(state.players)
    .filter((player) => player.uuid !== state.admin)
    .sort((a, b) => b.points - a.points);
  const host = Object.values(state.players).find(
    (player) => player.uuid === state.admin,
  );

  const podium = [
    { place: 2, player: players[1] },
    { place: 1, player: players[0] },
    { place: 3, player: players[2] },
  ];
  // Everyone below third place is not rendered as a tile.
  const rest = players.slice(3);

  const isSelf = (player: TriviaLobbyPlayer) => player.uuid === userData.uuid;

  return (
    <div
      className="EndScreen"
      onClick={() => {
        // Browsers suspend remote audio until a gesture; any click resumes it.
        void room?.startAudio();
      }}
    >
      <MediaControls />

      {host && (
        <div className="EndHost">
          <EndCamera player={host} isSelf={isSelf(host)} />
        </div>
      )}

      <div className="Podium">
        {podium.map(({ place, player }) => (
          <div key={place} className={`PodiumPlace place-${place}`}>
            <span className="PodiumPoints">
              {player ? player.points : "-"}
            </span>
            <div className="PodiumBlock">{place}</div>
            <div className="PodiumCamera">
              {player ? (
                <EndCamera player={player} isSelf={isSelf(player)} />
              ) : (
                <div className="EndCamera" />
              )}
            </div>
          </div>
        ))}
      </div>

      {rest.map((player) => (
        <EndAudio key={player.uuid} player={player} isSelf={isSelf(player)} />
      ))}
    </div>
  );
}
