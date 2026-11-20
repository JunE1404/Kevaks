import { useState } from "react";
import { CameraSettings } from "./CameraSettings";
import { useLanguage } from "../contexts/languageContext";
import { useLiveKit } from "../contexts/livekitContext";

/**
 * Floating mic/camera/settings controls. Lives in the bottom-right corner of
 * the game views rather than on the local camera tile, so it stays reachable
 * when the local player has no camera (or no tile).
 */
export function MediaControls() {
  const { localization } = useLanguage();
  const {
    cameraEnabled,
    microphoneEnabled,
    toggleCamera,
    toggleMicrophone,
  } = useLiveKit();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="MediaControls">
      <button
        type="button"
        className="FunctionButton"
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
        className="FunctionButton"
        onClick={() => {
          void toggleCamera();
        }}
      >
        {cameraEnabled
          ? localization.lobby.b_camera_off
          : localization.lobby.b_camera_on}
      </button>

      <button
        type="button"
        className="FunctionButton"
        onClick={() => setSettingsOpen(true)}
        aria-label={localization.lobby.l_camera_settings}
        title={localization.lobby.l_camera_settings}
      >
        ⚙
      </button>

      {settingsOpen && (
        <div className="ModalOverlay" onClick={() => setSettingsOpen(false)}>
          <div className="Modal" onClick={(event) => event.stopPropagation()}>
            <h2>{localization.lobby.l_camera_settings}</h2>
            {/* Never re-apply stored devices mid-call: it would swap the
                device out from under the live track. */}
            <CameraSettings restoreStoredDevices={false} />
            <button
              className="FunctionButton"
              type="button"
              onClick={() => setSettingsOpen(false)}
            >
              {localization.editor.b_close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
