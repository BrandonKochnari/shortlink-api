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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as LoginLocationState | null)?.from?.pathname ?? "/dashboard";

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
      setError(err instanceof Error ? err.message : "Unable to log in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-mint">Shortlink</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-normal">Sign in to your workspace</h1>
        <p className="mt-4 text-slate-600">
          Access your links and analytics using your Shortlink account.
        </p>
      </div>

      <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-mint transition focus:ring-2"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-mint transition focus:ring-2"
          placeholder="Password"
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full rounded-md bg-ink px-4 py-2 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-600">
          Need an account?{" "}
          <Link className="font-semibold text-mint hover:text-teal-700" to="/register">
            Register
          </Link>
        </p>
      </form>
    </section>
  );
}

