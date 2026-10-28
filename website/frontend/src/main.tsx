import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import { ProtectedDevRoute } from "./components/ProtectedDevRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Admin } from "./pages/Admin";
import { GameCreator } from "./pages/GameCreator";
import { Games } from "./pages/Games";
import { Home } from "./pages/Home";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Profile } from "./pages/Profile";
import { ResetPassword } from "./pages/ResetPassword";
import { TriviaEditor } from "./pages/TriviaEditor";
import { TriviaLobby } from "./pages/TriviaLobby";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Landing /> },
      { path: "login", element: <Login /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "home", element: <Home /> },
          { path: "profile", element: <Profile /> },
          { path: "reset-password", element: <ResetPassword /> },
          { path: "games", element: <Games /> },
          { path: "games/trivia/lobby", element: <TriviaLobby /> },
          {
            element: <ProtectedDevRoute />,
            children: [
              { path: "games/trivia/create", element: <GameCreator /> },
              {
                path: "games/trivia/create/:gameId",
                element: <TriviaEditor />,
              },
            ],
          },
          {
            element: <ProtectedAdminRoute />,
            children: [{ path: "admin", element: <Admin /> }],
          },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
