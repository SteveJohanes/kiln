import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getCurrentUser,
  login as loginApi,
} from "./api";
import type { UserIdentity } from "./auth-types";
import {
  getAccessToken,
  removeAccessToken,
  saveAccessToken,
} from "./auth-storage";

type AuthContextValue = {
  user: UserIdentity | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<UserIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await getAccessToken();

        if (!token) {
          setUser(null);
          return;
        }

        const response = await getCurrentUser();

        setUser(response.user);
      } catch (error) {
        console.error(
          "Session tidak valid atau sudah kedaluwarsa:",
          error,
        );

        await removeAccessToken();

        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    void restoreSession();
  }, []);

  async function login(
    email: string,
    password: string,
  ): Promise<void> {
    const response = await loginApi(
      email,
      password,
    );

    await saveAccessToken(response.accessToken);

    setUser(response.user);
  }

  async function logout(): Promise<void> {
    try {
      await removeAccessToken();
    } catch (error) {
      console.error(
        "Gagal menghapus access token:",
        error,
      );
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isLoggedIn: user !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth harus digunakan di dalam AuthProvider.",
    );
  }

  return context;
}