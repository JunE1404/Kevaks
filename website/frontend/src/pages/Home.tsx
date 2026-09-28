import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";

export function Home() {
  const { userData } = useAuth();
  const { localization } = useLanguage();

  return (
    <div className="PageContainer">
      <h1>{localization.home.l_title}</h1>
      <p>{localization.home.l_welcome.replace("{name}", userData.name)}</p>
    </div>
  );
}
