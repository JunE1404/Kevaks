import { useLiveKit } from "../contexts/livekitContext";
import { VideoTrackView } from "./LiveKitMedia";
import type { TriviaLobbyPlayer, TriviaLobbyState } from "../requests/trivia";

function EndCamera({ player }: { player: TriviaLobbyPlayer }) {
  const { roomIdentities, videoTrackFor } = useLiveKit();
  const inRoom =
    Boolean(player.livekitIdentity) &&
    roomIdentities.includes(player.livekitIdentity);
  const track = inRoom ? videoTrackFor(player.livekitIdentity) : null;

  return (
    <div className="EndCamera">
      {track && <VideoTrackView track={track} />}
      <span className="CameraName">{player.name}</span>
    </div>
  );
}

export function TriviaEndScreen({ state }: { state: TriviaLobbyState }) {
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

  return (
    <div className="EndScreen">
      {host && (
        <div className="EndHost">
          <EndCamera player={host} />
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
                <EndCamera player={player} />
              ) : (
                <div className="EndCamera" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
