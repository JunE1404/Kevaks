const CAMERA_KEY = "kevaks.trivia.cameraId";
const MICROPHONE_KEY = "kevaks.trivia.microphoneId";

export type StoredMediaDevices = {
  cameraId?: string;
  microphoneId?: string;
};

export function getStoredMediaDevices(): StoredMediaDevices {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    cameraId: window.localStorage.getItem(CAMERA_KEY) ?? undefined,
    microphoneId: window.localStorage.getItem(MICROPHONE_KEY) ?? undefined,
  };
}

export function setStoredCameraId(deviceId: string) {
  window.localStorage.setItem(CAMERA_KEY, deviceId);
}

export function setStoredMicrophoneId(deviceId: string) {
  window.localStorage.setItem(MICROPHONE_KEY, deviceId);
}
