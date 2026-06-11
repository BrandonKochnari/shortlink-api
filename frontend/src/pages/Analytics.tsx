import { API_BASE_URL } from "../api/config";

export function Analytics() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-coral">Analytics</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Link performance</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          A scaffold for click counts, referrer breakdowns, and per-link analytics from the API.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["Total clicks", "Active links", "Top link"].map((label) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold">--</p>
          </article>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
        <p className="text-sm text-slate-500">API base URL</p>
        <p className="mt-1 break-all font-mono text-sm text-slate-800">{API_BASE_URL}</p>
      </div>
    </section>
  );
}

