import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../api/config";
import { createShortUrl, fetchMyUrls, ShortUrl } from "../api/urls";
import { useAuth } from "../auth/AuthContext";
import { formatDateET } from "../lib/formatDate";

function toApiDateTime(value: string) {
  if (!value) {
    return undefined;
  }

  return new Date(value).toISOString();
}

function UrlSkeleton() {
  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
      {[0, 1, 2].map((item) => (
        <div key={item} className="grid gap-3 px-4 py-4 md:grid-cols-[1.1fr_1fr_140px_240px]">
          <div>
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton mt-2 h-3 w-28" />
          </div>
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-24" />
          <div className="flex gap-2">
            <div className="skeleton h-10 w-16" />
            <div className="skeleton h-10 w-16" />
            <div className="skeleton h-10 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { token } = useAuth();
  const [urls, setUrls] = useState<ShortUrl[]>([]);
  const [originalUrl, setOriginalUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [latestUrl, setLatestUrl] = useState<ShortUrl | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const sortedUrls = useMemo(
    () =>
      [...urls].sort(
        (first, second) =>
          new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
      ),
    [urls],
  );

  const expiringCount = urls.filter((url) => url.expires_at).length;
  const activeCount = urls.filter((url) => url.is_active).length;

  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchMyUrls(token)
      .then((items) => {
        if (isMounted) {
          setUrls(items);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load URLs.");
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
  }, [token]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      return;
    }

    setCreateError(null);
    setNotice(null);
    setIsCreating(true);

    try {
      const createdUrl = await createShortUrl(token, {
        original_url: originalUrl,
        ...(customAlias.trim() ? { custom_alias: customAlias.trim() } : {}),
        ...(expiresAt ? { expires_at: toApiDateTime(expiresAt) } : {}),
      });

      setUrls((currentUrls) => [createdUrl, ...currentUrls]);
      setLatestUrl(createdUrl);
      setNotice("Short URL created successfully.");
      setOriginalUrl("");
      setCustomAlias("");
      setExpiresAt("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to create URL.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (url: ShortUrl) => {
    try {
      await navigator.clipboard.writeText(url.short_url);
      setCopiedId(url.id);
      setNotice("Short URL copied to clipboard.");
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCreateError("Unable to copy the short URL.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="page-title">Manage short links</h1>
          <p className="page-copy">Create, copy, open, and inspect analytics for your shortened URLs.</p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
        <article className="panel panel-body">
          <p className="text-sm font-medium text-slate-500">Total links</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{urls.length}</p>
        </article>
        <article className="panel panel-body">
          <p className="text-sm font-medium text-slate-500">Active links</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{activeCount}</p>
        </article>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6">
          <form className="panel panel-body" onSubmit={handleCreate}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Create a short URL</h2>
                <p className="mt-1 text-sm text-slate-500">Only the original URL is required.</p>
              </div>
              <button type="submit" disabled={isCreating} className="btn-accent sm:min-w-28">
                {isCreating ? "Creating..." : "Create"}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {notice && <div className="alert-success">{notice}</div>}
              {createError && <div className="alert-error">{createError}</div>}
            </div>

            <div className="mt-5 grid gap-4">
              <label className="field-label" htmlFor="original-url">
                Original URL
                <input
                  id="original-url"
                  type="url"
                  value={originalUrl}
                  onChange={(event) => setOriginalUrl(event.target.value)}
                  className="field-input"
                  placeholder="https://example.com/article"
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="field-label" htmlFor="custom-alias">
                  Custom alias
                  <input
                    id="custom-alias"
                    type="text"
                    value={customAlias}
                    onChange={(event) => setCustomAlias(event.target.value)}
                    className="field-input"
                    placeholder="spring-launch"
                  />
                </label>

                <label className="field-label" htmlFor="expires-at">
                  Expires at
                  <input
                    id="expires-at"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="field-input"
                  />
                </label>
              </div>
            </div>

            {latestUrl && (
              <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4">
                <p className="text-sm font-semibold text-teal-900">Generated short URL</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <a
                    className="break-all font-mono text-sm text-teal-800 hover:text-teal-950"
                    href={latestUrl.short_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {latestUrl.short_url}
                  </a>
                  <button type="button" onClick={() => handleCopy(latestUrl)} className="btn-secondary">
                    {copiedId === latestUrl.id ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="panel panel-body">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Your links</h2>
                <p className="mt-1 text-sm text-slate-500">Newest links appear first.</p>
              </div>
              <p className="text-sm font-medium text-slate-500">{urls.length} total</p>
            </div>

            <div className="mt-6">
              {isLoading && <UrlSkeleton />}

              {error && <div className="alert-error">{error}</div>}

              {!isLoading && !error && sortedUrls.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-base font-semibold text-ink">No short URLs yet</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Create your first short link above. It will appear here with copy, open, and analytics actions.
                  </p>
                </div>
              )}

              {!isLoading && !error && sortedUrls.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="hidden bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[1.1fr_1fr_140px_240px]">
                    <span>Original</span>
                    <span>Short URL</span>
                    <span>Expires</span>
                    <span>Actions</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {sortedUrls.map((url) => (
                      <article
                        key={url.id}
                        className="grid gap-4 px-4 py-4 lg:grid-cols-[1.1fr_1fr_140px_240px] lg:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{url.original_url}</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">{url.short_code}</p>
                        </div>
                        <a
                          className="min-w-0 break-all font-mono text-sm text-mint hover:text-teal-700"
                          href={url.short_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {url.short_url}
                        </a>
                        <p className="text-sm text-slate-600">{url.expires_at ? formatDateET(url.expires_at) : "No expiration"}</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => handleCopy(url)} className="btn-secondary px-3">
                            {copiedId === url.id ? "Copied" : "Copy"}
                          </button>
                          <a className="btn-primary px-3" href={url.short_url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                          <Link
                            className="btn-coral px-3"
                            to={`/analytics/${encodeURIComponent(url.short_code)}`}
                          >
                            Analytics
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        <aside className="panel panel-body">
          <h2 className="text-lg font-semibold text-ink">API connection</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Authenticated requests use this deployed backend.</p>
          <p className="mt-4 break-all rounded-md bg-slate-100 p-3 font-mono text-xs text-slate-700">
            {API_BASE_URL}
          </p>
        </aside>
      </div>
    </section>
  );
}
