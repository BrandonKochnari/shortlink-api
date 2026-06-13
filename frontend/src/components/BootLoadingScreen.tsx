import { API_BASE_URL } from "../api/config";

export function BootLoadingScreen() {
  return (
    <div className="min-h-screen bg-cloud px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="panel panel-body relative w-full max-w-xl overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-100 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-mint/10 blur-3xl" />

          <div className="relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-mint shadow-soft">
              <div className="relative h-9 w-9 animate-pulse">
                <span className="absolute left-0 top-3 h-4 w-6 rotate-[-28deg] rounded-full border-4 border-current" />
                <span className="absolute right-0 top-2 h-4 w-6 rotate-[-28deg] rounded-full border-4 border-current" />
                <span className="absolute left-[13px] top-[15px] h-1.5 w-3 rounded-full bg-current" />
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="eyebrow">URL Shortlink</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink sm:text-4xl">
                Waking up the links...
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                This can take a moment if the server was resting.
              </p>
            </div>

            <div className="mt-8 space-y-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/2 animate-[boot-progress_1.6s_ease-in-out_infinite] rounded-full bg-mint" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="skeleton h-3 w-2/3" />
                    <div className="skeleton mt-3 h-6 w-full" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-2" aria-label="Checking API connection">
                {[0, 1, 2].map((item) => (
                  <span
                    key={item}
                    className="h-2.5 w-2.5 animate-[boot-dot_1.2s_ease-in-out_infinite] rounded-full bg-mint"
                    style={{ animationDelay: `${item * 0.16}s` }}
                  />
                ))}
              </div>
              <p className="break-all font-mono text-xs text-slate-500">
                Checking {API_BASE_URL}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
