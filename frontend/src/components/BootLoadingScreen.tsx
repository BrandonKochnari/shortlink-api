import { API_BASE_URL } from "../api/config";

export function BootLoadingScreen() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 px-4 text-ink sm:bottom-6 sm:px-6">
      <div className="mx-auto flex max-w-6xl justify-center sm:justify-end">
        <section className="panel panel-body pointer-events-auto relative w-full max-w-md overflow-hidden">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-100 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-14 -left-12 h-36 w-36 rounded-full bg-mint/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-mint shadow-soft">
                <div className="relative h-7 w-7 animate-pulse">
                  <span className="absolute left-0 top-2 h-3.5 w-5 rotate-[-28deg] rounded-full border-[3px] border-current" />
                  <span className="absolute right-0 top-1.5 h-3.5 w-5 rotate-[-28deg] rounded-full border-[3px] border-current" />
                  <span className="absolute left-[10px] top-[12px] h-1.5 w-2.5 rounded-full bg-current" />
                </div>
              </div>

              <div>
                <p className="eyebrow">URL Shortlink</p>
                <h1 className="mt-1 text-xl font-semibold tracking-normal text-ink">
                  Waking up the links...
                </h1>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  This can take a moment if the server was resting.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/2 animate-[boot-progress_1.6s_ease-in-out_infinite] rounded-full bg-mint" />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
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
                Checking {API_BASE_URL}/health
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
