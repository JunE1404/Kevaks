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
  admin: {
    l_title: string;
    b_home: string;
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
    l_mode_add: string;
    l_mode_status: string;
    l_mode_reset: string;
    l_name: string;
    l_admin: string;
    l_dev: string;
    l_uuid: string;
    b_submit: string;
    l_success_add: string;
    l_success_enable: string;
    l_success_disable: string;
    l_success_reset: string;
    l_failure: string;
    l_tmp_password: string;
    b_copy: string;
    b_copied: string;
    b_copy_uuid: string;
    l_hide_disabled: string;
  };
  landing: {
    l_title: string;
    l_subtitle: string;
    b_login: string;
  };
  errors: {
    generic: string;
    e20: string;
    e21: string;
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
