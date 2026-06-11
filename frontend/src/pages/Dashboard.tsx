import { API_BASE_URL } from "../api/config";

export function Dashboard() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-mint">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Manage short links</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          A starting point for listing, creating, and managing authenticated short URLs.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Your links</h2>
            <button className="rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700">
              New link
            </button>
          </div>
          <div className="mt-6 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Link table placeholder
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold">API connection</h2>
          <p className="mt-3 text-sm text-slate-600">
            Requests will use this base URL when feature wiring is added.
          </p>
          <p className="mt-4 break-all rounded-md bg-slate-100 p-3 font-mono text-xs text-slate-700">
            {API_BASE_URL}
          </p>
        </aside>
      </div>
    </section>
  );
}

