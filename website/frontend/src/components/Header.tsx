import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext";
import { useLanguage } from "../contexts/languageContext";
import AccountSVG, { ControllerSVG, HomeSVG } from "../assets/accountSVG";
import Kevaks from "../assets/kevaks.png"
export function Header() {
  const { isLoggedIn, userData } = useAuth();
  const { localization } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <header className="Header">
      <Link className="HeaderBrand" to="/">
        <img className="KevaksBrandImage" src={Kevaks}></img>
        {localization.landing.l_title}
      </Link>

      <nav className="HeaderNav">
        {isLoggedIn ? (
          <>
            <button className="HeaderButton" onClick={() => navigate("/home")}>
              <HomeSVG className="AccountIcon" color="var(--text)"></HomeSVG>
              {localization.home.l_title}</button>
            <button className="HeaderButton" onClick={() => navigate("/games")}>
              <ControllerSVG className="AccountIcon" color="var(--text)"/>
              {localization.games.l_title}</button>
            <button className="HeaderButton" type="button" onClick={() => navigate("/profile")}>
              <AccountSVG className="AccountIcon" color="var(--text)"/>
              {userData.name}
            </button>
          </>
        ) : (
          pathname !== "/login" && (
            <>
              <a
                  className="HeaderButton"
                  href="https://mein.online-impressum.de/kevaksss/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {localization.imprint.b_imprint}
              </a>
              <button
                className="HeaderButton"
                type="button"
                onClick={() => navigate("/login")}
              >
              <AccountSVG className="AccountIcon" color="var(--text)" />
              {localization.landing.b_login}
            </button></>

            
          )
        )}
      </nav>
    </header>
  );
}
