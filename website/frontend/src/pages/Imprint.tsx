import { useLanguage } from "../contexts/languageContext";

export function Imprint() {
  const { localization } = useLanguage();

  return (
    <div className="PageContainer">
      <h1>{localization.imprint.l_title}</h1>
      <p className="Subtitle">{localization.imprint.l_placeholder}</p>
    </div>
  );
}
