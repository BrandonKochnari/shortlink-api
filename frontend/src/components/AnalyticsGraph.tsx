import { useEffect, useMemo, useState } from "react";
import {
  AnalyticsRange,
  UrlAnalyticsTimeseries,
} from "../api/urls";
import { formatDateET } from "../lib/formatDate";

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

type AnalyticsGraphProps = {
  loadTimeseries: (range: AnalyticsRange) => Promise<UrlAnalyticsTimeseries>;
};

export function AnalyticsGraph({ loadTimeseries }: AnalyticsGraphProps) {
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [timeseries, setTimeseries] = useState<UrlAnalyticsTimeseries | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    loadTimeseries(range)
      .then((data) => {
        if (isMounted) {
          setTimeseries(data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load click history.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [loadTimeseries, range]);

  const maxClicks = useMemo(
    () => Math.max(0, ...(timeseries?.points.map((point) => point.clicks) ?? [])),
    [timeseries],
  );
  const hasClicks = maxClicks > 0;

  return (
    <div className="panel panel-body">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Usage over time</h2>
          <p className="mt-1 text-sm text-slate-500">Clicks grouped by the selected timespan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={[
                "rounded-md border px-3 py-2 text-sm font-semibold transition",
                range === option.value
                  ? "border-mint bg-mint text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="skeleton mt-6 h-56 w-full" />}

      {error && <div className="alert-error mt-6">{error}</div>}

      {!isLoading && !error && !hasClicks && (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-base font-semibold text-ink">No clicks in this timespan</p>
          <p className="mt-2 text-sm text-slate-500">Traffic will appear here after the short link is opened.</p>
        </div>
      )}

      {!isLoading && !error && hasClicks && timeseries && (
        <div className="mt-6">
          <div className="flex h-56 items-end gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4">
            {timeseries.points.map((point) => {
              const height = `${Math.max(8, (point.clicks / maxClicks) * 100)}%`;

              return (
                <div key={point.period_start} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <div
                    className="w-full rounded-t bg-mint"
                    style={{ height }}
                    title={`${formatDateET(point.period_start)}: ${point.clicks} clicks`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-between text-xs text-slate-500">
            <span>{formatDateET(timeseries.points[0]?.period_start)}</span>
            <span>{formatDateET(timeseries.points[timeseries.points.length - 1]?.period_start)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
