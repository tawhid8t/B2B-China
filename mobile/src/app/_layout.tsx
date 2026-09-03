import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/auth/auth-provider";
import { authRouteAccess } from "@/auth/route-access";
import { AppErrorBoundary } from "@/foundation/app-error-boundary";
import { NetworkProvider } from "@/foundation/network";
import { AppQueryProvider } from "@/foundation/query-client";

function AuthenticatedStack() {
  const { status } = useAuth();
  const access = authRouteAccess(status);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={access.startup}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={access.signedOut}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={access.client}>
        <Stack.Screen name="(client)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppQueryProvider>
          <NetworkProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <AuthenticatedStack />
            </AuthProvider>
          </NetworkProvider>
        </AppQueryProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
