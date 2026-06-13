import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { checkApiHealth } from "./api/health";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./auth/AuthContext";
import { Analytics } from "./pages/Analytics";
import { Dashboard } from "./pages/Dashboard";
import { GuestAnalytics } from "./pages/GuestAnalytics";
import { GuestDashboard } from "./pages/GuestDashboard";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ShortLinkRedirect } from "./pages/ShortLinkRedirect";

export function App() {
  const [isApiReady, setIsApiReady] = useState(false);

  useEffect(() => {
    if (isApiReady) {
      return;
    }

    const controller = new AbortController();
    let isCancelled = false;

    const checkBackend = async () => {
      try {
        await checkApiHealth(controller.signal);
        if (!isCancelled) {
          setIsApiReady(true);
        }
      } catch {
        // Route-level API calls handle their own loading and error states.
      }
    };

    void checkBackend();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [isApiReady]);

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
