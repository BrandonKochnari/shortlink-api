import { Link } from "react-router-dom";

export function Register() {
  return (
    <section className="mx-auto max-w-xl">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-coral">Create account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Register for Shortlink</h1>
      </div>

      <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <label className="block text-sm font-medium text-slate-700" htmlFor="register-email">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-coral transition focus:ring-2"
          placeholder="you@example.com"
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="register-password">
          Password
        </label>
        <input
          id="register-password"
          type="password"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-coral transition focus:ring-2"
          placeholder="Choose a password"
        />

        <button
          type="button"
          className="mt-6 w-full rounded-md bg-coral px-4 py-2 font-semibold text-white transition hover:bg-red-600"
        >
          Register
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

