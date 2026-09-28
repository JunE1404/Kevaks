import { Link } from "react-router-dom";
import { useLanguage } from "../contexts/languageContext";

export function Landing() {
  const { localization } = useLanguage();

  return (
    <div className="PageContainer">
      <h1>{localization.landing.l_title}</h1>
      <p className="Subtitle">{localization.landing.l_subtitle}</p>
      <Link to="/login">{localization.landing.b_login}</Link>
    </div>
  );
}
