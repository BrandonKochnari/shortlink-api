import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isInitializing, login } = useAuth();
  const locationState = location.state as LoginLocationState | null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = locationState?.from?.pathname ?? "/dashboard";

  if (!isInitializing && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in. Check your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto grid max-w-5xl gap-8 py-6 lg:grid-cols-[1fr_420px] lg:items-center lg:py-12">
      <div>
        <p className="eyebrow">URL Shortlink</p>
        <h1 className="page-title">Sign in to manage your links</h1>
        <p className="page-copy">
          Create short URLs, copy them quickly, and review click analytics from one focused workspace.
        </p>
      </div>

      <form className="panel panel-body" onSubmit={handleSubmit}>
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-ink">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Use your account email and password.</p>
        </div>

        {error && <div className="alert-error mb-4">{error}</div>}

        <label className="field-label" htmlFor="email">
          Email
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field-input"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="field-label mt-4" htmlFor="password">
          Password
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field-input"
            placeholder="Password"
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" disabled={isSubmitting} className="btn-primary mt-6 w-full">
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-600">
          Need an account?{" "}
          <Link className="font-semibold text-mint hover:text-blue-700" to="/register">
            Register
          </Link>
        </p>
      </form>
    </section>
  );
}
