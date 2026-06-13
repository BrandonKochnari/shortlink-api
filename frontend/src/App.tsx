import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { checkApiHealth } from "./api/health";
import { AppLayout } from "./components/AppLayout";
import { BootLoadingScreen } from "./components/BootLoadingScreen";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./auth/AuthContext";
import { Analytics } from "./pages/Analytics";
import { Dashboard } from "./pages/Dashboard";
import { GuestAnalytics } from "./pages/GuestAnalytics";
import { GuestDashboard } from "./pages/GuestDashboard";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ShortLinkRedirect } from "./pages/ShortLinkRedirect";

const MAX_BOOT_ATTEMPTS = 8;
const BOOT_RETRY_DELAY_MS = 3000;

export function App() {
  const [isApiReady, setIsApiReady] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(1);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const retryBoot = useCallback(() => {
    setBootAttempt(1);
    setBootError(null);
    setRetryNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (isApiReady) {
      return;
    }

    const controller = new AbortController();
    let timeoutId: number | undefined;
    let isCancelled = false;

    const checkBackend = async (attempt: number) => {
      setBootAttempt(attempt);
      setBootError(null);

      try {
        await checkApiHealth(controller.signal);
        if (!isCancelled) {
          setIsApiReady(true);
        }
      } catch {
        if (isCancelled) {
          return;
        }

        if (attempt >= MAX_BOOT_ATTEMPTS) {
          setBootError("We could not reach the API yet. Give it another try in a moment.");
          return;
        }

        timeoutId = window.setTimeout(() => {
          void checkBackend(attempt + 1);
        }, BOOT_RETRY_DELAY_MS);
      }
    };

    void checkBackend(1);

    return () => {
      isCancelled = true;
      controller.abort();
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isApiReady, retryNonce]);

  if (!isApiReady) {
    return (
      <BootLoadingScreen
        attempt={bootAttempt}
        error={bootError}
        isRetrying={!bootError}
        onRetry={retryBoot}
      />
    );
  }

  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/guest" element={<GuestDashboard />} />
          <Route path="/guest/analytics/:shortCode" element={<GuestAnalytics />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
            <Route path="/analytics/:shortCode" element={<Analytics />} />
          </Route>
          <Route path="/:shortCode" element={<ShortLinkRedirect />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
