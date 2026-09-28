import { createContext, useContext } from "react";
import type { AuthUser } from "../requests/auth";

export type Userdata = AuthUser;

export const defaultUserData: Userdata = {
  uuid: "",
  name: "",
  admin: false,
  dev: false,
  temp: false,
};

type AuthContextType = {
  loading: boolean;
  isLoggedIn: boolean;
  userData: Userdata;
  login: (name: string, password: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  loading: true,
  isLoggedIn: false,
  userData: defaultUserData,
  login: async () => false,
  logout: async () => false,
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
