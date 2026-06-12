import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Analytics } from "./pages/Analytics";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ShortLinkRedirect } from "./pages/ShortLinkRedirect";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
          <Route path="/analytics/:shortCode" element={<Analytics />} />
        </Route>
        <Route path="/:shortCode" element={<ShortLinkRedirect />} />
      </Route>
    </Routes>
  );
}
