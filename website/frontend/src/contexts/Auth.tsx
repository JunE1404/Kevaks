
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { autoLogin, login as loginRequest, logout as logoutRequest } from "../requests/auth";
import { AuthContext, defaultUserData, type Userdata } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<Userdata>(defaultUserData);

  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function attemptAutoLogin() {
      try {
        const user = await autoLogin();
        if (!active) return;
        if (user) {
          setUserData(user);
          setIsLoggedIn(true);
          navigate("/home");
  }
      } finally {
        if (active) {
          setLoading(false);
  }
      }
    }

    attemptAutoLogin();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function login(name: string, password: string): Promise<boolean> {
    setLoading(true);
    try {
      const user = await loginRequest(name, password);
      if (!user) {
        return false;
      }
    setUserData(user);
      setIsLoggedIn(true);
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function logout(): Promise<boolean> {
    setLoading(true);
    try {
      const success = await logoutRequest();
      setUserData(defaultUserData);
      setIsLoggedIn(false);
      return success;
    } finally {
      setLoading(false);
    }
  }

  async function refreshUser(): Promise<void> {
    const user = await autoLogin();
    if (user) {
      setUserData(user);
      setIsLoggedIn(true);
    }
  }

  return (
    <AuthContext.Provider value={{ loading, isLoggedIn, userData, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
