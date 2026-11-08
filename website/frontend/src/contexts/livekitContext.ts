import { createContext, useContext } from "react";
import type { LocalTrack, Participant, Room, Track } from "livekit-client";

export type LiveKitContextType = {
  room: Room | null;
  connected: boolean;
  identity: string | null;
  error: string | null;
  cameraDevices: MediaDeviceInfo[];
  microphoneDevices: MediaDeviceInfo[];
  cameraId: string;
  microphoneId: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  localCameraTrack: LocalTrack | null;
  localMicrophoneTrack: LocalTrack | null;
  roomIdentities: string[];
  roomVersion: number;
  setupLocalTracks: () => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
  selectMicrophone: (deviceId: string) => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  participantFor: (identity?: string) => Participant | null;
  videoTrackFor: (identity?: string) => Track | null;
  audioTrackFor: (identity?: string) => Track | null;
};

export const LiveKitContext = createContext<LiveKitContextType>({
  room: null,
  connected: false,
  identity: null,
  error: null,
  cameraDevices: [],
  microphoneDevices: [],
  cameraId: "",
  microphoneId: "",
  cameraEnabled: false,
  microphoneEnabled: false,
  localCameraTrack: null,
  localMicrophoneTrack: null,
  roomIdentities: [],
  roomVersion: 0,
  setupLocalTracks: async () => {},
  selectCamera: async () => {},
  selectMicrophone: async () => {},
  toggleCamera: async () => {},
  toggleMicrophone: async () => {},
  participantFor: () => null,
  videoTrackFor: () => null,
  audioTrackFor: () => null,
});

export function useLiveKit() {
  return useContext(LiveKitContext);
}
