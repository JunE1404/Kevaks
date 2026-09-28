import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";

export function Home() {
  const { userData, logout } = useAuth();
  const { localization } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="PageContainer">
      <h1>{localization.home.l_title}</h1>
      <p>{localization.home.l_welcome.replace("{name}", userData.name)}</p>

      {userData.admin && (
        <button type="button" onClick={() => navigate("/admin")}>
          {localization.admin.l_title}
        </button>
      )}

      <button type="button" onClick={() => logout()}>
        {localization.home.b_logout}
      </button>
    </div>
  );
}
