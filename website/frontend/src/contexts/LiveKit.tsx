import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import {
  ConnectionState,
  createLocalTracks,
  Room,
  RoomEvent,
  Track,
  VideoPreset,
  VideoPresets,
  type LocalTrack,
  type Participant,
} from "livekit-client";
import { getTriviaJoinToken, registerTriviaIdentity } from "../requests/trivia";
import {
  getStoredMediaDevices,
  setStoredCameraId,
  setStoredMicrophoneId,
} from "../utils/deviceStorage";
import { useAuth } from "./authContext";
import { LiveKitContext } from "./livekitContext";
import { useTriviaSocket } from "./triviaSocketContext";

const VIDEO_FRAME_RATE = 60;
const VIDEO_BITRATE = 3_500_000;
const VIDEO_RESOLUTION = {
  ...VideoPresets.h720.resolution,
  frameRate: VIDEO_FRAME_RATE,
};
const VIDEO_SIMULCAST_LAYERS = [
  new VideoPreset(320, 180, 200_000, VIDEO_FRAME_RATE),
  new VideoPreset(640, 360, 800_000, VIDEO_FRAME_RATE),
];

export function LiveKitProvider() {
  const { gameState } = useTriviaSocket();
  const { userData } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isAdminPath = location.pathname.endsWith("/admin");

  const [room] = useState(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: VIDEO_RESOLUTION },
        publishDefaults: {
          videoEncoding: {
            maxBitrate: VIDEO_BITRATE,
            maxFramerate: VIDEO_FRAME_RATE,
          },
          videoSimulcastLayers: VIDEO_SIMULCAST_LAYERS,
        },
      }),
  );
  const [connected, setConnected] = useState(false);
  const [identity, setIdentity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState(() => {
    const fromUrl = searchParams.get("cameraId");
    if (fromUrl) {
      return fromUrl;
    }
    return getStoredMediaDevices().cameraId ?? "";
  });
  const [microphoneId, setMicrophoneId] = useState(() => {
    const fromUrl = searchParams.get("microphoneId");
    if (fromUrl) {
      return fromUrl;
    }
    return getStoredMediaDevices().microphoneId ?? "";
  });
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [localCameraTrack, setLocalCameraTrack] = useState<LocalTrack | null>(null);
  const [localMicrophoneTrack, setLocalMicrophoneTrack] =
    useState<LocalTrack | null>(null);
  const [roomVersion, setRoomVersion] = useState(0);

  const cameraTrackRef = useRef<LocalTrack | null>(null);
  const microphoneTrackRef = useRef<LocalTrack | null>(null);
  const tokenRef = useRef<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const preparePromiseRef = useRef<Promise<void> | null>(null);
  const connectingRef = useRef(false);
  const mountedRef = useRef(true);
  const isAdminPathRef = useRef(isAdminPath);

  function prepare(): Promise<void> {
    if (!preparePromiseRef.current) {
      preparePromiseRef.current = (async () => {
        try {
          const data = await getTriviaJoinToken();
          await room.prepareConnection(data.url, data.token);
          urlRef.current = data.url;
          tokenRef.current = data.token;
          setIdentity(data.identity);
          await registerTriviaIdentity(data.identity);
        } catch (err) {
          preparePromiseRef.current = null;
          setError(err instanceof Error ? err.message : "LiveKit setup failed");
        }
      })();
    }
    return preparePromiseRef.current;
  }

  const setupPromiseRef = useRef<Promise<void> | null>(null);

  function setupLocalTracks(): Promise<void> {
    if (setupPromiseRef.current) {
      return setupPromiseRef.current;
    }
    setupPromiseRef.current = (async () => {
      setError(null);
      try {
        const [cameras, microphones] = await Promise.all([
          Room.getLocalDevices("videoinput"),
          Room.getLocalDevices("audioinput"),
        ]);
        setCameraDevices(cameras);
        setMicrophoneDevices(microphones);

        const camera = cameras.some(
          (device) => device.deviceId === cameraId,
        )
          ? cameraId
          : cameras[0]?.deviceId || "";
        const microphone = microphones.some(
          (device) => device.deviceId === microphoneId,
        )
          ? microphoneId
          : microphones[0]?.deviceId || "";
        if (camera) {
          setCameraId(camera);
          setStoredCameraId(camera);
        }
        if (microphone) {
          setMicrophoneId(microphone);
          setStoredMicrophoneId(microphone);
        }

        const tracks = await createLocalTracks({
          audio: microphone ? { deviceId: microphone } : true,
          video: camera
            ? { deviceId: camera, resolution: VIDEO_RESOLUTION }
            : { resolution: VIDEO_RESOLUTION },
        });

        const cameraTrack =
          tracks.find((track) => track.kind === Track.Kind.Video) ?? null;
        const microphoneTrack =
          tracks.find((track) => track.kind === Track.Kind.Audio) ?? null;

        cameraTrackRef.current?.stop();
        microphoneTrackRef.current?.stop();
        cameraTrackRef.current = cameraTrack;
        microphoneTrackRef.current = microphoneTrack;
        setLocalCameraTrack(cameraTrack);
        setLocalMicrophoneTrack(microphoneTrack);
        setCameraEnabled(cameraTrack ? !cameraTrack.isMuted : false);
        setMicrophoneEnabled(
          microphoneTrack ? !microphoneTrack.isMuted : false,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not access the camera or microphone",
        );
      }
    })().finally(() => {
      setupPromiseRef.current = null;
    });
    return setupPromiseRef.current;
  }

  async function selectCamera(deviceId: string) {
    setError(null);
    const target = deviceId || cameraId;
    if (target) {
      setCameraId(target);
      setStoredCameraId(target);
    }
    try {
      if (room.state === ConnectionState.Connected) {
        const publication = room.localParticipant.getTrackPublication(
          Track.Source.Camera,
        );
        if (publication) {
          if (target) {
            await room.switchActiveDevice("videoinput", target);
          }
          return;
        }
      }

      const tracks = await createLocalTracks({
        video: target
          ? { deviceId: target, resolution: VIDEO_RESOLUTION }
          : { resolution: VIDEO_RESOLUTION },
      });
      const cameraTrack =
        tracks.find((track) => track.kind === Track.Kind.Video) ?? null;
      cameraTrackRef.current?.stop();
      cameraTrackRef.current = cameraTrack;
      setLocalCameraTrack(cameraTrack);
      setCameraEnabled(cameraTrack ? !cameraTrack.isMuted : false);
      if (cameraTrack && room.state === ConnectionState.Connected) {
        await room.localParticipant.publishTrack(cameraTrack);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch camera");
    }
  }

  async function selectMicrophone(deviceId: string) {
    setError(null);
    const target = deviceId || microphoneId;
    if (target) {
      setMicrophoneId(target);
      setStoredMicrophoneId(target);
    }
    try {
      if (room.state === ConnectionState.Connected) {
        const publication = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        );
        if (publication) {
          if (target) {
            await room.switchActiveDevice("audioinput", target);
          }
          return;
        }
      }

      const tracks = await createLocalTracks({
        audio: target ? { deviceId: target } : true,
      });
      const microphoneTrack =
        tracks.find((track) => track.kind === Track.Kind.Audio) ?? null;
      microphoneTrackRef.current?.stop();
      microphoneTrackRef.current = microphoneTrack;
      setLocalMicrophoneTrack(microphoneTrack);
      setMicrophoneEnabled(
        microphoneTrack ? !microphoneTrack.isMuted : false,
      );
      if (microphoneTrack && room.state === ConnectionState.Connected) {
        await room.localParticipant.publishTrack(microphoneTrack);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not switch microphone",
      );
    }
  }

  async function connect() {
    if (
      isAdminPathRef.current ||
      connectingRef.current ||
      room.state === ConnectionState.Connected
    ) {
      return;
    }
    connectingRef.current = true;
    try {
      await prepare();
      if (isAdminPathRef.current || !urlRef.current || !tokenRef.current) {
        return;
      }
      if (!cameraTrackRef.current && !microphoneTrackRef.current) {
        await setupLocalTracks();
      }
      if (isAdminPathRef.current) {
        return;
      }

      await room.connect(urlRef.current, tokenRef.current);
      if (isAdminPathRef.current || !mountedRef.current) {
        room.disconnect();
        return;
      }
      if (cameraTrackRef.current) {
        await room.localParticipant.publishTrack(cameraTrackRef.current);
      }
      if (microphoneTrackRef.current) {
        await room.localParticipant.publishTrack(
          microphoneTrackRef.current,
        );
      }

      setConnected(true);
      setRoomVersion((version) => version + 1);
      room.startAudio().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the room");
    } finally {
      connectingRef.current = false;
    }
  }

  async function toggleCamera() {
    const track = cameraTrackRef.current;
    if (!track) {
      await selectCamera(cameraId);
      return;
    }
    if (track.isMuted) {
      await track.unmute();
    } else {
      await track.mute();
    }
    setCameraEnabled(!track.isMuted);
  }

  async function toggleMicrophone() {
    const track = microphoneTrackRef.current;
    if (!track) {
      await selectMicrophone(microphoneId);
      return;
    }
    if (track.isMuted) {
      await track.unmute();
    } else {
      await track.mute();
    }
    setMicrophoneEnabled(!track.isMuted);
  }

  function participantFor(identityValue?: string): Participant | null {
    if (!identityValue) {
      return null;
    }
    if (room.localParticipant.identity === identityValue) {
      return room.localParticipant;
    }
    return room.remoteParticipants.get(identityValue) ?? null;
  }

  function videoTrackFor(identityValue?: string): Track | null {
    return (
      participantFor(identityValue)?.getTrackPublication(Track.Source.Camera)
        ?.track ?? null
    );
  }

  function audioTrackFor(identityValue?: string): Track | null {
    return (
      participantFor(identityValue)?.getTrackPublication(
        Track.Source.Microphone,
      )?.track ?? null
    );
  }

  useEffect(() => {
    const bump = () => setRoomVersion((version) => version + 1);
    const handleConnected = () => {
      setConnected(true);
      bump();
    };
    const handleDisconnected = () => {
      setConnected(false);
      bump();
    };

    room.on(RoomEvent.ParticipantConnected, bump);
    room.on(RoomEvent.ParticipantDisconnected, bump);
    room.on(RoomEvent.TrackSubscribed, bump);
    room.on(RoomEvent.TrackUnsubscribed, bump);
    room.on(RoomEvent.TrackMuted, bump);
    room.on(RoomEvent.TrackUnmuted, bump);
    room.on(RoomEvent.LocalTrackPublished, bump);
    room.on(RoomEvent.LocalTrackUnpublished, bump);
    room.on(RoomEvent.Reconnected, bump);
    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, bump);
      room.off(RoomEvent.ParticipantDisconnected, bump);
      room.off(RoomEvent.TrackSubscribed, bump);
      room.off(RoomEvent.TrackUnsubscribed, bump);
      room.off(RoomEvent.TrackMuted, bump);
      room.off(RoomEvent.TrackUnmuted, bump);
      room.off(RoomEvent.LocalTrackPublished, bump);
      room.off(RoomEvent.LocalTrackUnpublished, bump);
      room.off(RoomEvent.Reconnected, bump);
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      room.disconnect();
      cameraTrackRef.current?.stop();
      microphoneTrackRef.current?.stop();
      cameraTrackRef.current = null;
      microphoneTrackRef.current = null;
    };
  }, [room]);

  useEffect(() => {
    isAdminPathRef.current = isAdminPath;
  }, [isAdminPath]);

  useEffect(() => {
    if (!isAdminPath) {
      return;
    }
    cameraTrackRef.current?.stop();
    microphoneTrackRef.current?.stop();
    cameraTrackRef.current = null;
    microphoneTrackRef.current = null;
  }, [isAdminPath]);

  const hasGameState = gameState !== null;
  const prepareRef = useRef(prepare);
  const connectRef = useRef(connect);

  useEffect(() => {
    prepareRef.current = prepare;
    connectRef.current = connect;
  });

  useEffect(() => {
    if (!hasGameState || isAdminPath) {
      return;
    }
    void prepareRef.current();
  }, [hasGameState, isAdminPath]);

  const lobbyState = gameState?.lobbyState ?? 0;
  const isOwner = gameState?.admin === userData.uuid;
  useEffect(() => {
    if (lobbyState === 0 || isAdminPath) {
      return;
    }
    if (isOwner && location.pathname.endsWith("/lobby")) {
      return;
    }
    void connectRef.current();
  }, [lobbyState, room, isAdminPath, isOwner, location.pathname]);

  const roomIdentities =
    room.state === ConnectionState.Connected
      ? [room.localParticipant.identity, ...room.remoteParticipants.keys()]
      : [];

  return (
    <LiveKitContext.Provider
      value={{
        room,
        connected,
        identity,
        error,
        cameraDevices,
        microphoneDevices,
        cameraId,
        microphoneId,
        cameraEnabled,
        microphoneEnabled,
        localCameraTrack,
        localMicrophoneTrack,
        roomIdentities,
        roomVersion,
        setupLocalTracks,
        selectCamera,
        selectMicrophone,
        toggleCamera,
        toggleMicrophone,
        participantFor,
        videoTrackFor,
        audioTrackFor,
      }}
    >
      <Outlet />
    </LiveKitContext.Provider>
  );
}
