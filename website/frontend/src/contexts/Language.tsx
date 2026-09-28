import { useState } from "react";
import type { ReactNode } from "react";
import { LanguageContext, translations } from "./languageContext";

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang_code, setLangCode] = useState<string>(
    () => localStorage.getItem("language") ?? "en",
  );

  function changeLang(code: string) {
    setLangCode(code);
    localStorage.setItem("language", code);
  }

  const localization = translations[lang_code] ?? translations.en;

  return (
    <LanguageContext.Provider value={{ lang_code, localization, setLangCode: changeLang }}>
      {children}
    </LanguageContext.Provider>
  );
}
