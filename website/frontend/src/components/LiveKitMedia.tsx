import { useEffect, useRef } from "react";
import type { Track } from "livekit-client";

export function VideoTrackView({
  track,
  muted = false,
  mirrored = false,
}: {
  track: Track;
  muted?: boolean;
  mirrored?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return (
    <video
      ref={ref}
      className={`CameraVideo${mirrored ? " mirrored" : ""}`}
      autoPlay
      playsInline
      muted={muted}
    />
  );
}

export function AudioTrackView({ track }: { track: Track }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return <audio ref={ref} className="RemoteAudio" autoPlay />;
}
