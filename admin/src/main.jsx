import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router";
import * as Sentry from "@sentry/react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isClerkKeyValid =
  typeof PUBLISHABLE_KEY === "string" &&
  (PUBLISHABLE_KEY.startsWith("pk_test_") || PUBLISHABLE_KEY.startsWith("pk_live_"));

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn && sentryDsn.startsWith("https://")) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: true,
    enableLogs: true,
    integrations: [Sentry.replayIntegration()],
    replaysSessionSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
  });
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Admin dashboard runtime error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-base-300 flex items-center justify-center p-6 text-base-content">
          <div className="card w-full max-w-lg bg-base-100 shadow-xl border border-error/30">
            <div className="card-body">
              <h2 className="card-title text-error text-xl">Admin Dashboard Error</h2>
              <p className="text-sm opacity-80">
                The application encountered an unexpected runtime error:
              </p>
              <pre className="bg-base-200 p-3 rounded font-mono text-xs overflow-x-auto text-error border border-base-300">
                {this.state.error?.message || String(this.state.error)}
              </pre>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ClerkSetupNotice() {
  return (
    <div className="min-h-screen bg-base-300 flex items-center justify-center p-6 text-base-content">
      <div className="card w-full max-w-xl bg-base-100 shadow-xl border border-warning/40">
        <div className="card-body">
          <div className="flex items-center gap-3 mb-2">
            <span className="badge badge-warning font-bold">Action Needed</span>
            <h2 className="card-title text-xl">Clerk Publishable Key Required</h2>
          </div>
          <p className="text-sm opacity-80">
            The Admin dashboard uses Clerk for secure authentication. The publishable key currently configured in{" "}
            <code className="text-warning">admin/.env</code> is a placeholder:
          </p>
          <div className="bg-base-200 p-3 rounded font-mono text-xs break-all border border-base-300 my-2">
            VITE_CLERK_PUBLISHABLE_KEY={PUBLISHABLE_KEY || "(empty)"}
          </div>
          <div className="space-y-2 mt-2">
            <p className="text-sm font-semibold">How to enable authentication:</p>
            <ol className="list-decimal list-inside text-sm space-y-1 opacity-90 pl-1">
              <li>Open your project file: <code className="text-primary">admin/.env</code></li>
              <li>
                Get your Publishable Key from{" "}
                <a
                  href="https://dashboard.clerk.com"
                  target="_blank"
                  rel="noreferrer"
                  className="link link-primary"
                >
                  dashboard.clerk.com
                </a>
              </li>
              <li>
                Set <code className="font-mono">VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</code>
              </li>
              <li>Save the file and refresh this page</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      {isClerkKeyValid ? (
        <BrowserRouter>
          <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
            <QueryClientProvider client={queryClient}>
              <App />
            </QueryClientProvider>
          </ClerkProvider>
        </BrowserRouter>
      ) : (
        <ClerkSetupNotice />
      )}
    </ErrorBoundary>
  </StrictMode>
);
