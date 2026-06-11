import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchUrlAnalytics, UrlAnalytics } from "../api/urls";
import { useAuth } from "../auth/AuthContext";

function formatDate(value: string | null) {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
        active ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600",
      ].join(" ")}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ExpirationBadge({ expired }: { expired: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
        expired ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600",
      ].join(" ")}
    >
      {expired ? "Expired" : "Not expired"}
    </span>
  );
}

export function Analytics() {
  const { shortCode } = useParams();
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<UrlAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !shortCode) {
      setIsLoading(false);
      setError("Missing short code");
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchUrlAnalytics(token, shortCode)
      .then((data) => {
        if (isMounted) {
          setAnalytics(data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load analytics");
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
  }, [shortCode, token]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-coral">Analytics</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Link performance</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Review click activity and status for a short URL.
          </p>
        </div>
        <Link
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          to="/dashboard"
        >
          Back to dashboard
        </Link>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-soft">
          Loading analytics...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && analytics && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
              <p className="text-sm font-medium text-slate-500">Clicks</p>
              <p className="mt-3 text-3xl font-semibold">{analytics.clicks}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
              <p className="text-sm font-medium text-slate-500">Status</p>
              <div className="mt-3">
                <StatusBadge active={analytics.is_active} />
              </div>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
              <p className="text-sm font-medium text-slate-500">Expiration</p>
              <div className="mt-3">
                <ExpirationBadge expired={analytics.is_expired} />
              </div>
            </article>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Details</h2>
            <dl className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-slate-500">Short code</dt>
                <dd className="mt-1 font-mono text-sm text-slate-900">{analytics.short_code}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Original URL</dt>
                <dd className="mt-1 break-all text-sm text-slate-900">{analytics.original_url}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Created at</dt>
                <dd className="mt-1 text-sm text-slate-900">{formatDate(analytics.created_at)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Last clicked</dt>
                <dd className="mt-1 text-sm text-slate-900">{formatDate(analytics.last_clicked)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Expires at</dt>
                <dd className="mt-1 text-sm text-slate-900">{formatDate(analytics.expires_at)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Clicks</dt>
                <dd className="mt-1 text-sm text-slate-900">{analytics.clicks}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Is active</dt>
                <dd className="mt-1 text-sm text-slate-900">{analytics.is_active ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Is expired</dt>
                <dd className="mt-1 text-sm text-slate-900">{analytics.is_expired ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </div>
        </>
      )}
    </section>
  );
}
