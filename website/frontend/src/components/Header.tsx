import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";

export function Header() {
  const { isLoggedIn, userData } = useAuth();
  const { localization } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <header className="Header">
      <Link className="HeaderBrand" to="/">
        {localization.landing.l_title}
      </Link>

      <nav className="HeaderNav">
        {isLoggedIn ? (
          <>
            <Link to="/home">{localization.home.l_title}</Link>
            {userData.admin && (
              <Link to="/admin">{localization.admin.l_title}</Link>
            )}
            <button type="button" onClick={() => navigate("/profile")}>
              {userData.name}
            </button>
          </>
        ) : (
          pathname !== "/login" && (
            <Link to="/login">{localization.landing.b_login}</Link>
          )
        )}
      </nav>
    </header>
  );
}
