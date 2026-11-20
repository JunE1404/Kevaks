import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../contexts/languageContext";
import { useLiveKit } from "../contexts/livekitContext";
import { getStoredMediaDevices } from "../utils/deviceStorage";

export function CameraSettings() {
  const { localization } = useLanguage();
  const liveKit = useLiveKit();
  const [searchParams] = useSearchParams();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    loadedRef.current = true;

    if (searchParams.has("cameraId") || searchParams.has("microphoneId")) {
      return;
    }

    const stored = getStoredMediaDevices();
    if (stored.cameraId && stored.cameraId !== liveKit.cameraId) {
      void liveKit.selectCamera(stored.cameraId);
    }
    if (stored.microphoneId && stored.microphoneId !== liveKit.microphoneId) {
      void liveKit.selectMicrophone(stored.microphoneId);
    }
  }, [liveKit, searchParams]);

  return (
    <div className="CameraSettings">
      <label className="LobbyDevice">
        <span>{localization.lobby.l_camera}</span>
        <select
          value={liveKit.cameraId}
          onChange={(event) => {
            void liveKit.selectCamera(event.target.value);
          }}
          disabled={liveKit.cameraDevices.length === 0}
        >
          {liveKit.cameraDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || device.deviceId}
            </option>
          ))}
        </select>
      </label>

      <label className="LobbyDevice">
        <span>{localization.lobby.l_microphone}</span>
        <select
          value={liveKit.microphoneId}
          onChange={(event) => {
            void liveKit.selectMicrophone(event.target.value);
          }}
          disabled={liveKit.microphoneDevices.length === 0}
        >
          {liveKit.microphoneDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || device.deviceId}
            </option>
          ))}
        </select>
      </label>

      {!liveKit.localCameraTrack && (
        <button
          className="FunctionButton"
          type="button"
          onClick={() => {
            void liveKit.setupLocalTracks();
          }}
        >
          {localization.lobby.b_setup_media}
        </button>
      )}

      {liveKit.error && <p className="FormError">{liveKit.error}</p>}
    </div>
  );
}
