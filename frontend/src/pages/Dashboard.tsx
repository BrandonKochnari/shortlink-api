import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../api/config";
import { createShortUrl, fetchMyUrls, ShortUrl } from "../api/urls";
import { useAuth } from "../auth/AuthContext";

function formatDate(value: string | null) {
  if (!value) {
    return "No expiration";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toApiDateTime(value: string) {
  if (!value) {
    return undefined;
  }

  return new Date(value).toISOString();
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
  const [createError, setCreateError] = useState<string | null>(null);

  const sortedUrls = useMemo(
    () =>
      [...urls].sort(
        (first, second) =>
          new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
      ),
    [urls],
  );

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
          setError(err instanceof Error ? err.message : "Unable to load URLs");
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
    setIsCreating(true);

    try {
      const createdUrl = await createShortUrl(token, {
        original_url: originalUrl,
        ...(customAlias.trim() ? { custom_alias: customAlias.trim() } : {}),
        ...(expiresAt ? { expires_at: toApiDateTime(expiresAt) } : {}),
      });

      setUrls((currentUrls) => [createdUrl, ...currentUrls]);
      setLatestUrl(createdUrl);
      setOriginalUrl("");
      setCustomAlias("");
      setExpiresAt("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to create URL");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (url: ShortUrl) => {
    try {
      await navigator.clipboard.writeText(url.short_url);
      setCopiedId(url.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCreateError("Unable to copy the short URL");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-mint">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Manage short links</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Create short URLs and manage the links attached to your account.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft" onSubmit={handleCreate}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Create a short URL</h2>
                <p className="mt-1 text-sm text-slate-500">Add an alias or expiration when needed.</p>
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isCreating ? "Creating..." : "Create"}
              </button>
            </div>

            {createError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="mt-5 grid gap-4">
              <label className="block text-sm font-medium text-slate-700" htmlFor="original-url">
                Original URL
                <input
                  id="original-url"
                  type="url"
                  value={originalUrl}
                  onChange={(event) => setOriginalUrl(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 font-normal outline-none ring-mint transition focus:ring-2"
                  placeholder="https://example.com/article"
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="custom-alias">
                  Custom alias
                  <input
                    id="custom-alias"
                    type="text"
                    value={customAlias}
                    onChange={(event) => setCustomAlias(event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 font-normal outline-none ring-mint transition focus:ring-2"
                    placeholder="spring-launch"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700" htmlFor="expires-at">
                  Expires at
                  <input
                    id="expires-at"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 font-normal outline-none ring-mint transition focus:ring-2"
                  />
                </label>
              </div>
            </div>

            {latestUrl && (
              <div className="mt-5 rounded-md border border-teal-200 bg-teal-50 p-4">
                <p className="text-sm font-medium text-teal-900">Generated short URL</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <a
                    className="break-all font-mono text-sm text-teal-800 hover:text-teal-950"
                    href={latestUrl.short_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {latestUrl.short_url}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(latestUrl)}
                    className="rounded-md border border-teal-300 px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
                  >
                    {copiedId === latestUrl.id ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Your links</h2>
              <p className="text-sm text-slate-500">{urls.length} total</p>
            </div>

            {isLoading && (
              <div className="mt-6 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Loading URLs...
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {!isLoading && !error && sortedUrls.length === 0 && (
              <div className="mt-6 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No short URLs yet.
              </div>
            )}

            {!isLoading && !error && sortedUrls.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
                <div className="hidden bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[1fr_1fr_150px_230px]">
                  <span>Original</span>
                  <span>Short URL</span>
                  <span>Expires</span>
                  <span>Actions</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {sortedUrls.map((url) => (
                    <article
                      key={url.id}
                      className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_1fr_150px_230px] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{url.original_url}</p>
                        <p className="mt-1 text-xs text-slate-500">Code: {url.short_code}</p>
                      </div>
                      <a
                        className="min-w-0 break-all font-mono text-sm text-mint hover:text-teal-700"
                        href={url.short_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {url.short_url}
                      </a>
                      <p className="text-sm text-slate-600">{formatDate(url.expires_at)}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(url)}
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          {copiedId === url.id ? "Copied" : "Copy"}
                        </button>
                        <a
                          className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                          href={url.short_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                        <Link
                          className="rounded-md bg-coral px-3 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                          to={`/analytics/${encodeURIComponent(url.short_code)}`}
                        >
                          View analytics
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold">API connection</h2>
          <p className="mt-3 text-sm text-slate-600">Authenticated URL requests use this base URL.</p>
          <p className="mt-4 break-all rounded-md bg-slate-100 p-3 font-mono text-xs text-slate-700">
            {API_BASE_URL}
          </p>
        </aside>
      </div>
    </section>
  );
}
