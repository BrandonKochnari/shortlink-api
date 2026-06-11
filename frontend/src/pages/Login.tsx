import { Link } from "react-router-dom";

export function Login() {
  return (
    <section className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-mint">Shortlink</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-normal">Sign in to your workspace</h1>
        <p className="mt-4 text-slate-600">
          Authentication wiring will connect this form to the FastAPI login route in a later pass.
        </p>
      </div>

      <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <label className="block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-mint transition focus:ring-2"
          placeholder="you@example.com"
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-mint transition focus:ring-2"
          placeholder="••••••••"
        />

        <button
          type="button"
          className="mt-6 w-full rounded-md bg-ink px-4 py-2 font-semibold text-white transition hover:bg-slate-700"
        >
          Log in
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

