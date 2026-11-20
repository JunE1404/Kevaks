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
import { Imprint } from "./pages/Imprint";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Profile } from "./pages/Profile";
import { ResetPassword } from "./pages/ResetPassword";
import { TriviaEditor } from "./pages/TriviaEditor";
import { TriviaError } from "./pages/TriviaError";
import { TriviaGame } from "./pages/TriviaGame";
import { TriviaLobby } from "./pages/TriviaLobby";
import { TriviaSocketProvider } from "./contexts/TriviaSocket";
import { LiveKitProvider } from "./contexts/LiveKit";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Landing /> },
      { path: "login", element: <Login /> },
      { path: "imprint", element: <Imprint /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "home", element: <Home /> },
          { path: "profile", element: <Profile /> },
          { path: "reset-password", element: <ResetPassword /> },
          { path: "games", element: <Games /> },
          {
            element: <TriviaSocketProvider />,
            children: [
              {
                element: <LiveKitProvider />,
                children: [
                  { path: "game/trivia/lobby", element: <TriviaLobby /> },
                  { path: "game/trivia/ingame", element: <TriviaGame /> },
                  { path: "game/trivia/admin", element: <TriviaGame /> },
                ],
              },
            ],
          },
          { path: "games/trivia/error", element: <TriviaError /> },
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
