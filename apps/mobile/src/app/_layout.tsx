import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../lib/auth-context";

function AuthGuard() {
  const {
    isLoading,
    isLoggedIn,
  } = useAuth();

  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!navigationState?.key) {
      return;
    }

    const isLoginScreen =
      segments[0] === "auth" &&
      segments[1] === "login";

    if (!isLoggedIn && !isLoginScreen) {
      router.replace("/auth/login");
      return;
    }

    if (isLoggedIn && isLoginScreen) {
      router.replace("/");
    }
  }, [
    isLoading,
    isLoggedIn,
    navigationState?.key,
    segments,
    router,
  ]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGuard />
    </AuthProvider>
  );
}