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

function Badge({ tone, children }: { tone: "neutral" | "success" | "danger"; children: string }) {
  const toneClass = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-blue-50 text-blue-700",
    danger: "bg-red-50 text-red-700",
  }[tone];

  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="panel panel-body">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton mt-4 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="panel panel-body">
        <div className="skeleton h-5 w-24" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item}>
              <div className="skeleton h-3 w-20" />
              <div className="skeleton mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
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
      setError("Missing short code.");
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
          setError(err instanceof Error ? err.message : "Unable to load analytics.");
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
      <div className="page-header">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1 className="page-title">Link performance</h1>
          <p className="page-copy">Review traffic and status details for this short URL.</p>
        </div>
        <Link className="btn-secondary" to="/dashboard">
          Back to dashboard
        </Link>
      </div>

      {isLoading && <AnalyticsSkeleton />}

      {error && (
        <div className="panel panel-body">
          <div className="alert-error">{error}</div>
        </div>
      )}

      {!isLoading && !error && analytics && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="panel panel-body">
              <p className="text-sm font-medium text-slate-500">Clicks</p>
              <p className="mt-3 text-4xl font-semibold text-ink">{analytics.clicks}</p>
            </article>
            <article className="panel panel-body">
              <p className="text-sm font-medium text-slate-500">Status</p>
              <div className="mt-3">
                <Badge tone={analytics.is_active ? "success" : "neutral"}>
                  {analytics.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </article>
            <article className="panel panel-body">
              <p className="text-sm font-medium text-slate-500">Expiration</p>
              <div className="mt-3">
                <Badge tone={analytics.is_expired ? "danger" : "neutral"}>
                  {analytics.is_expired ? "Expired" : "Not expired"}
                </Badge>
              </div>
            </article>
          </div>

          <div className="panel panel-body">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Details</h2>
                <p className="mt-1 text-sm text-slate-500">Backend analytics for code {analytics.short_code}.</p>
              </div>
              <Badge tone={analytics.is_expired ? "danger" : analytics.is_active ? "success" : "neutral"}>
                {analytics.is_expired ? "Expired" : analytics.is_active ? "Live" : "Paused"}
              </Badge>
            </div>

            <dl className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="text-sm font-medium text-slate-500">Short code</dt>
                <dd className="mt-1 font-mono text-sm text-slate-900">{analytics.short_code}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="text-sm font-medium text-slate-500">Original URL</dt>
                <dd className="mt-1 break-all text-sm text-slate-900">{analytics.original_url}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="text-sm font-medium text-slate-500">Created at</dt>
                <dd className="mt-1 text-sm text-slate-900">{formatDate(analytics.created_at)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="text-sm font-medium text-slate-500">Last clicked</dt>
                <dd className="mt-1 text-sm text-slate-900">{formatDate(analytics.last_clicked)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="text-sm font-medium text-slate-500">Expires at</dt>
                <dd className="mt-1 text-sm text-slate-900">{formatDate(analytics.expires_at)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="text-sm font-medium text-slate-500">Flags</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={analytics.is_active ? "success" : "neutral"}>
                    {analytics.is_active ? "is_active: true" : "is_active: false"}
                  </Badge>
                  <Badge tone={analytics.is_expired ? "danger" : "neutral"}>
                    {analytics.is_expired ? "is_expired: true" : "is_expired: false"}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>
        </>
      )}
    </section>
  );
}
