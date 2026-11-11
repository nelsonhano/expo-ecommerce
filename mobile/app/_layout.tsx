import { Stack } from "expo-router";
import "../global.css";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import * as Sentry from "@sentry/react-native";
import { StripeProvider } from "@/lib/stripe";
import { Platform, Text, View } from "react-native";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn && sentryDsn.startsWith("https://")) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: true,
    enableLogs: true,
    replaysSessionSampleRate: 1.0,
    replaysOnErrorSampleRate: 1,
    integrations: Platform.OS === "web" ? [] : [Sentry.mobileReplayIntegration()],
  });
}

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkKeyValid =
  typeof clerkPublishableKey === "string" &&
  (clerkPublishableKey.startsWith("pk_test_") || clerkPublishableKey.startsWith("pk_live_"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any, query) => {
      Sentry.captureException(error, {
        tags: {
          type: "react-query-error",
          queryKey: query.queryKey[0]?.toString() || "unknon",
        },
        extra: {
          errorMessage: error.message,
          statusCode: error.response?.status,
          queryKey: query.queryKey,
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: any) => {
      Sentry.captureException(error, {
        tags: { type: "react-query-mutation-error" },
        extra: {
          errorMessage: error.message,
          statusCode: error.response?.status,
        },
      });
    },
  }),
});

function ClerkSetupNotice() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        backgroundColor: "#0f172a",
      }}
    >
      <View
        style={{
          backgroundColor: "#1e293b",
          padding: 24,
          borderRadius: 12,
          maxWidth: 480,
          width: "100%",
          borderWidth: 1,
          borderColor: "#eab308",
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "bold",
            color: "#f8fafc",
            marginBottom: 8,
          }}
        >
          Clerk Publishable Key Required
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: "#94a3b8",
            marginBottom: 12,
            lineHeight: 20,
          }}
        >
          The mobile client requires a valid Clerk Publishable Key for authentication.
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: "#f59e0b",
            fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
            marginBottom: 16,
          }}
        >
          EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY={clerkPublishableKey || "(empty)"}
        </Text>
        <Text style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 22 }}>
          1. Open mobile/.env{"\n"}
          2. Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY with your key from dashboard.clerk.com{"\n"}
          3. Key must start with pk_test_ or pk_live_{"\n"}
          4. Reload the application
        </Text>
      </View>
    </View>
  );
}

export default Sentry.wrap(function RootLayout() {
  if (!isClerkKeyValid) {
    return <ClerkSetupNotice />;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={Platform.OS !== "web" ? tokenCache : undefined}
    >
      <QueryClientProvider client={queryClient}>
        <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}>
          <Stack screenOptions={{ headerShown: false }} />
        </StripeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
});
