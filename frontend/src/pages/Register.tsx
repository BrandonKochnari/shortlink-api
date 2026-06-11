import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Register() {
  const navigate = useNavigate();
  const { isAuthenticated, isInitializing, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isInitializing && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-coral">Create account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Register for Shortlink</h1>
      </div>

      <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-slate-700" htmlFor="register-email">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-coral transition focus:ring-2"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="register-password">
          Password
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-coral transition focus:ring-2"
          placeholder="Choose a password"
          autoComplete="new-password"
          required
          minLength={8}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full rounded-md bg-coral px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Creating account..." : "Register"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link className="font-semibold text-coral hover:text-red-600" to="/login">
            Log in
          </Link>
        </p>
      </form>
    </section>
  );
}

