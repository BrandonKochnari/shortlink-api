import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../api/config";
import {
  activateShortUrl,
  buildOpenShortUrl,
  buildShortUrl,
  createShortUrl,
  deactivateShortUrl,
  deleteShortUrl,
  fetchMyUrls,
  ShortUrl,
  updateShortUrl,
} from "../api/urls";
import { useAuth } from "../auth/AuthContext";
import { formatDateET } from "../lib/formatDate";

function toApiDateTime(value: string) {
  if (!value) {
    return undefined;
  }

  return new Date(value).toISOString();
}

function toDateTimeLocalInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function UrlSkeleton() {
  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
      {[0, 1, 2].map((item) => (
        <div key={item} className="px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-3 w-32" />
            </div>
            <div className="flex gap-2">
              <div className="skeleton h-10 w-16" />
              <div className="skeleton h-10 w-16" />
              <div className="skeleton h-10 w-24" />
              <div className="skeleton h-10 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type UrlListTransform = (items: ShortUrl[]) => ShortUrl[];

export function Dashboard() {
  const { token } = useAuth();
  const [urls, setUrls] = useState<ShortUrl[]>([]);
  const [originalUrl, setOriginalUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [latestUrl, setLatestUrl] = useState<ShortUrl | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [actionCode, setActionCode] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const latestFetchId = useRef(0);

  const sortedUrls = useMemo(
    () =>
      [...urls].sort(
        (first, second) =>
          new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
      ),
    [urls],
  );

  const activeCount = urls.filter((url) => url.is_active).length;
  const expiringCount = urls.filter((url) => url.expires_at).length;

  const cancelEditing = useCallback(() => {
    setEditingCode(null);
    setEditExpiresAt("");
    setDeleteCode(null);
  }, []);

  const loadUrls = useCallback(async (transform?: UrlListTransform) => {
    if (!token) {
      return [];
    }

    const fetchId = latestFetchId.current + 1;
    latestFetchId.current = fetchId;
    setError(null);
    const items = await fetchMyUrls(token);
    const nextItems = transform ? transform(items) : items;

    if (fetchId === latestFetchId.current) {
      setUrls(nextItems);
    }

    return nextItems;
  }, [token]);

  const refreshUrlsAfterMutation = useCallback(async (transform?: UrlListTransform) => {
    await loadUrls(transform);
    cancelEditing();
    setLatestUrl(null);
  }, [cancelEditing, loadUrls]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    loadUrls()
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
  }, [loadUrls]);

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
        ...(expiresAt ? { expires_at: toApiDateTime(expiresAt) } : {}),
      });

      await refreshUrlsAfterMutation((items) => {
        if (items.some((item) => item.short_code === createdUrl.short_code)) {
          return items;
        }

        return [createdUrl, ...items];
      });
      setLatestUrl(createdUrl);
      setNotice("Short URL created successfully.");
      setOriginalUrl("");
      setExpiresAt("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to create URL.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (url: ShortUrl) => {
    const currentShortUrl = buildShortUrl(url.short_code);

    try {
      await navigator.clipboard.writeText(currentShortUrl);
      setCopiedId(url.id);
      setNotice("Short URL copied to clipboard.");
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCreateError("Unable to copy the short URL.");
    }
  };

  const startEditing = (url: ShortUrl) => {
    setEditingCode(url.short_code);
    setEditExpiresAt(toDateTimeLocalInput(url.expires_at));
    setDeleteCode(null);
    setNotice(null);
    setCreateError(null);
  };

  const handleUpdate = async (shortCode: string) => {
    if (!token) {
      return;
    }

    setActionCode(shortCode);
    setCreateError(null);
    setNotice(null);

    try {
      const nextExpiresAt = editExpiresAt ? toApiDateTime(editExpiresAt) ?? null : null;
      await updateShortUrl(token, shortCode, {
        expires_at: nextExpiresAt,
      });
      await refreshUrlsAfterMutation((items) =>
        items.map((item) =>
          item.short_code === shortCode ? { ...item, expires_at: nextExpiresAt } : item,
        ),
      );
      setNotice("URL expiration updated.");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to update URL.");
    } finally {
      setActionCode(null);
    }
  };

  const handleToggleActive = async (url: ShortUrl) => {
    if (!token) {
      return;
    }

    setActionCode(url.short_code);
    setCreateError(null);
    setNotice(null);

    try {
      if (url.is_active) {
        await deactivateShortUrl(token, url.short_code);
        await refreshUrlsAfterMutation((items) =>
          items.map((item) =>
            item.short_code === url.short_code ? { ...item, is_active: false } : item,
          ),
        );
        setNotice("URL deactivated.");
      } else {
        await activateShortUrl(token, url.short_code);
        await refreshUrlsAfterMutation((items) =>
          items.map((item) =>
            item.short_code === url.short_code ? { ...item, is_active: true } : item,
          ),
        );
        setNotice("URL activated.");
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to change URL status.");
    } finally {
      setActionCode(null);
    }
  };

  const handleDelete = async (shortCode: string) => {
    if (!token) {
      return;
    }

    setActionCode(shortCode);
    setCreateError(null);
    setNotice(null);

    try {
      await deleteShortUrl(token, shortCode);
      await refreshUrlsAfterMutation((items) =>
        items.filter((item) => item.short_code !== shortCode),
      );
      setNotice("URL deleted.");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to delete URL.");
    } finally {
      setActionCode(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="page-title">Manage short links</h1>
          <p className="page-copy">Create, update, copy, open, and inspect analytics for your shortened URLs.</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <form className="panel panel-body" onSubmit={handleCreate}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Create a short URL</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The short code is generated automatically.
                </p>
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

            {latestUrl && (
              <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">Generated short URL</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <a
                    className="truncate font-mono text-sm text-blue-800 hover:text-blue-950"
                    href={buildOpenShortUrl(latestUrl.short_code)}
                    target="_blank"
                    rel="noreferrer"
                    title={buildShortUrl(latestUrl.short_code)}
                  >
                    {buildShortUrl(latestUrl.short_code)}
                  </a>
                  <button type="button" onClick={() => handleCopy(latestUrl)} className="btn-secondary">
                    {copiedId === latestUrl.id ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <aside className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              <article className="panel panel-body">
                <p className="text-sm font-medium text-slate-500">Total links</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{urls.length}</p>
              </article>
              <article className="panel panel-body">
                <p className="text-sm font-medium text-slate-500">Active links</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{activeCount}</p>
              </article>
            </div>

            <div className="panel panel-body">
              <h2 className="text-lg font-semibold text-ink">API connection</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Requests are sent to this backend.
              </p>
              <p className="mt-4 break-all rounded-md bg-slate-100 p-3 font-mono text-xs text-slate-700">
                {API_BASE_URL}
              </p>
            </div>
          </aside>
        </div>

          <div className="panel panel-body">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Your links</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Basic actions are shown by default. Edit a row to manage status, expiration, or deletion.
                </p>
              </div>
              <p className="text-sm font-medium text-slate-500">
                {urls.length} total / {expiringCount} with expiration
              </p>
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
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="divide-y divide-slate-200">
                    {sortedUrls.map((url) => (
                      <article key={url.id} className="px-4 py-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={[
                                  "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
                                  url.is_active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600",
                                ].join(" ")}
                              >
                                {url.is_active ? "Active" : "Inactive"}
                              </span>
                              <span className="font-mono text-xs text-slate-500">{url.short_code}</span>
                              <span className="text-xs text-slate-400">
                                {url.expires_at ? `Expires ${formatDateET(url.expires_at)}` : "No expiration"}
                              </span>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Original URL
                                </p>
                                <p
                                  className="mt-1 truncate text-sm font-semibold text-slate-800"
                                  title={url.original_url}
                                >
                                  {url.original_url}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Short URL
                                </p>
                                <a
                                  className="mt-1 block truncate font-mono text-sm text-mint hover:text-blue-700"
                                  href={buildOpenShortUrl(url.short_code)}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={buildShortUrl(url.short_code)}
                                >
                                  {buildShortUrl(url.short_code)}
                                </a>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-72 lg:justify-end">
                            <button type="button" onClick={() => handleCopy(url)} className="btn-secondary px-3">
                              {copiedId === url.id ? "Copied" : "Copy"}
                            </button>
                            <a
                              className="btn-primary px-3"
                              href={buildOpenShortUrl(url.short_code)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open
                            </a>
                            <Link
                              className="btn-analytics px-3"
                              to={`/analytics/${encodeURIComponent(url.short_code)}`}
                            >
                              Analytics
                            </Link>
                            <button type="button" onClick={() => startEditing(url)} className="btn-secondary px-3">
                              Edit
                            </button>
                          </div>
                        </div>

                        {editingCode === url.short_code && (
                          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                              <label className="field-label flex-1" htmlFor={`edit-expires-${url.id}`}>
                                Expiration
                                <input
                                  id={`edit-expires-${url.id}`}
                                  type="datetime-local"
                                  value={editExpiresAt}
                                  onChange={(event) => setEditExpiresAt(event.target.value)}
                                  className="field-input bg-white"
                                />
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={actionCode === url.short_code}
                                  onClick={() => handleUpdate(url.short_code)}
                                  className="btn-accent"
                                >
                                  {actionCode === url.short_code ? "Saving..." : "Save"}
                                </button>
                                <button type="button" onClick={cancelEditing} className="btn-secondary">
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={actionCode === url.short_code}
                                  onClick={() => handleToggleActive(url)}
                                  className="btn-secondary"
                                >
                                  {url.is_active ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteCode(url.short_code)}
                                  className="btn-secondary border-red-200 text-red-700 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {deleteCode === url.short_code && (
                          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                            <p className="text-sm font-semibold text-red-800">Delete this short URL?</p>
                            <p className="mt-1 text-sm text-red-700">
                              This removes the code and future redirects will return 404.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={actionCode === url.short_code}
                                onClick={() => handleDelete(url.short_code)}
                                className="btn-coral"
                              >
                                {actionCode === url.short_code ? "Deleting..." : "Confirm delete"}
                              </button>
                              <button type="button" onClick={() => setDeleteCode(null)} className="btn-secondary">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>
    </section>
  );
}
