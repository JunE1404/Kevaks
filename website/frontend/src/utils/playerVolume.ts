import { useSyncExternalStore } from "react";

// Per-player playback volume, keyed by player uuid so the value survives
// unmounts and follows a participant between the game screen and the end
// screen (both render the same players, but as different components).
const volumes = new Map<string, number>();
const listeners = new Set<() => void>();

const DEFAULT_VOLUME = 1.0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPlayerVolume(playerId: string): number {
  return volumes.get(playerId) ?? DEFAULT_VOLUME;
}

export function setPlayerVolume(playerId: string, volume: number) {
  volumes.set(playerId, volume);
  listeners.forEach((listener) => listener());
}

/**
 * Reads (and optionally writes) the remembered volume for a player. Every
 * component showing that player re-renders, so their audio element and any
 * other mount of the same slider stay in sync.
 */
export function usePlayerVolume(
  playerId: string,
): [number, (volume: number) => void] {
  const volume = useSyncExternalStore(subscribe, () =>
    getPlayerVolume(playerId),
  );

  return [
    volume,
    (next: number) => {
      setPlayerVolume(playerId, next);
    },
  ];
}
