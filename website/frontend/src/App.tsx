import { Link, Outlet, useLocation } from "react-router-dom";
import "./App.css";
import { Header } from "./components/Header";
import { AuthProvider } from "./contexts/Auth";
import { LangProvider } from "./contexts/Language";
import { useAuth } from "./contexts/authContext";
import { useLanguage } from "./contexts/languageContext";

function AppShell() {
  const { userData } = useAuth();
  const { localization } = useLanguage();
  const location = useLocation();

  const showTempBanner = userData.temp && location.pathname !== "/reset-password";
  const hideHeader = /^\/game(\/|$)/.test(location.pathname);

  return (
    <>
      {!hideHeader && <Header />}
      {showTempBanner && (
        <div className="TempBanner">
          <span>{localization.password.l_temp_banner}</span>
          <Link className="LinkButton" to="/reset-password">
            {localization.password.b_reset}
          </Link>
        </div>
      )}
      <Outlet />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <AppShell />
      </LangProvider>
    </AuthProvider>
  );
}

export default App;
