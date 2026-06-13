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
      setError(err instanceof Error ? err.message : "Unable to create your account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto grid max-w-5xl gap-8 py-6 lg:grid-cols-[1fr_420px] lg:items-center lg:py-12">
      <div>
        <p className="eyebrow text-coral">Create account</p>
        <h1 className="page-title">Start shortening links</h1>
        <p className="page-copy">
          Register once, then keep your short URLs and analytics tied to your account.
        </p>
      </div>

      <form className="panel panel-body" onSubmit={handleSubmit}>
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-ink">Create your account</h2>
          <p className="mt-1 text-sm text-slate-500">Use a valid email and a secure password.</p>
        </div>

        {error && <div className="alert-error mb-4">{error}</div>}

        <label className="field-label" htmlFor="register-email">
          Email
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field-input"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="field-label mt-4" htmlFor="register-password">
          Password
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field-input"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </label>

        <button type="submit" disabled={isSubmitting} className="btn-coral mt-6 w-full">
          {isSubmitting ? "Creating account..." : "Register"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link className="font-semibold text-coral hover:text-red-600" to="/login">
            Log in
          </Link>
        </p>
      </form>
    </section>
  );
}
