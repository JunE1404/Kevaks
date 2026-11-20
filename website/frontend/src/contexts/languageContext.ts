import { createContext, useContext } from "react";
import translationsJson from "../assets/translations.json";

export interface Localization {
  login: {
    l_title: string;
    l_username: string;
    l_password: string;
    b_login: string;
    e_login_failed: string;
  };
  home: {
    l_title: string;
    l_welcome: string;
    b_logout: string;
  };
  games: {
    l_title: string;
    l_trivia: string;
    l_live: string;
    l_offline: string;
    e_no_lobby: string;
    l_lobby_placeholder: string;
    b_back: string;
  };
  creator: {
    l_title: string;
    b_create: string;
    b_back: string;
    l_loading: string;
    l_empty: string;
    l_done: string;
    l_in_progress: string;
    b_delete: string;
  };
  editor: {
    l_title: string;
    l_game_title: string;
    b_back: string;
    b_save: string;
    b_open_lobby: string;
    l_saving: string;
    l_saved: string;
    l_dirty: string;
    l_loading: string;
    b_add_board: string;
    b_add_row: string;
    b_add_column: string;
    b_delete_row: string;
    b_delete_category: string;
    l_points: string;
    l_empty_field: string;
    l_field_special: string;
    l_special_name: string;
    l_question: string;
    l_answer: string;
    b_close: string;
    e_load: string;
  };
  lobby: {
    l_connecting: string;
    l_players: string;
    l_empty: string;
    l_admin: string;
    b_start: string;
    l_started: string;
    l_error_title: string;
    l_admin_panel: string;
    l_board: string;
    l_loading_board: string;
    l_no_opponents: string;
    b_correct: string;
    b_incorrect: string;
    b_buzz: string;
    b_next_round: string;
    b_next_board: string;
    b_finish_game: string;
    b_open_stream: string;
    l_free_for_all: string;
    l_phase: string;
    l_phase_waiting: string;
    l_phase_choice: string;
    l_phase_buzz: string;
    l_phase_answer: string;
    l_phase_finished: string;
    l_phase_scored: string;
    l_camera: string;
    l_microphone: string;
    l_volume: string;
    l_camera_off: string;
    l_camera_settings: string;
    b_setup_media: string;
    b_mute: string;
    b_unmute: string;
    b_camera_off: string;
    b_camera_on: string;
  };
  admin: {
    l_title: string;
    l_loading: string;
    l_col_name: string;
    l_col_role: string;
    l_col_status: string;
    l_col_temp: string;
    l_col_last_login: string;
    l_enabled: string;
    l_disabled: string;
    l_yes: string;
    l_no: string;
    l_never: string;
    l_col_actions: string;
    l_create_account: string;
    l_name: string;
    l_admin: string;
    l_dev: string;
    b_submit: string;
    b_enable: string;
    b_disable: string;
    b_reset_password: string;
    l_success_add: string;
    l_success_enable: string;
    l_success_disable: string;
    l_success_reset: string;
    l_failure: string;
    l_tmp_password: string;
    b_copy: string;
    b_copied: string;
    l_hide_disabled: string;
  };
  landing: {
    l_title: string;
    l_subtitle: string;
    l_handle_tiktok: string;
    l_handle_twitch: string;
    l_handle_youtube: string;
    l_handle_instagram: string;
    b_login: string;
  };
  errors: {
    generic: string;
    e20: string;
    e21: string;
    e30: string;
    e31: string;
    e32: string;
  };
  password: {
    l_title: string;
    l_password: string;
    l_repeat: string;
    b_submit: string;
    l_temp_banner: string;
    b_reset: string;
    e_length: string;
    e_special: string;
    e_characters: string;
    e_mismatch: string;
  };
  profile: {
    l_title: string;
    l_name: string;
    b_edit: string;
    b_cancel: string;
    b_submit: string;
  };
  footer: {
    l_credit: string;
    l_contact: string;
  };
  imprint: {
    l_title: string;
    b_imprint: string;
    l_placeholder: string;
  };
}

export type Translations = { [lang: string]: Localization };

export const translations = translationsJson as Translations;

export type LanguageContextType = {
  lang_code: string;
  localization: Localization;
  setLangCode: (lang: string) => void;
};

export const LanguageContext = createContext<LanguageContextType>({
  lang_code: "en",
  localization: translations.en,
  setLangCode: () => {},
});

export function useLanguage() {
  return useContext(LanguageContext);
}
