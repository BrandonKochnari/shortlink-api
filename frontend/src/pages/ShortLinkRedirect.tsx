import { useEffect, useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../api/config";

const APP_ROUTE_PREFIXES = new Set(["analytics", "dashboard", "guest", "login", "register"]);

export function ShortLinkRedirect() {
  const { shortCode } = useParams();

  const redirectUrl = useMemo(() => {
    if (!shortCode) {
      return null;
    }

    return `${API_BASE_URL}/${encodeURIComponent(shortCode)}?_open=${Date.now()}`;
  }, [shortCode]);

  useEffect(() => {
    if (redirectUrl) {
      window.location.replace(redirectUrl);
    }
  }, [redirectUrl]);

  if (!shortCode || APP_ROUTE_PREFIXES.has(shortCode)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
      <h1 className="text-lg font-semibold text-ink">Opening short link</h1>
      <p className="mt-2 text-sm text-slate-500">Redirecting you now.</p>
    </section>
  );
}
