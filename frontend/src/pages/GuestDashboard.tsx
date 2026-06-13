import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../api/config";
import {
  buildOpenShortUrl,
  buildShortUrl,
  createGuestShortUrlForToken,
  deleteGuestShortUrl,
  fetchGuestUrls,
  ShortUrl,
} from "../api/urls";
import { getGuestToken } from "../lib/guestToken";
import { formatDateET } from "../lib/formatDate";

type UrlListTransform = (items: ShortUrl[]) => ShortUrl[];

export function GuestDashboard() {
  const [guestToken] = useState(() => getGuestToken());
  const [urls, setUrls] = useState<ShortUrl[]>([]);
  const [originalUrl, setOriginalUrl] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [actionCode, setActionCode] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [menuCode, setMenuCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<{ shortCode: string; message: string; tone: "success" | "error" } | null>(null);
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
  const isDeleting = (shortCode: string) => actionCode === shortCode;
  const apiConnectionCard = (
    <div className="panel panel-body flex-1">
      <h2 className="text-lg font-semibold text-ink">API connection</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Requests are sent to this backend.
      </p>
      <p className="mt-4 break-all rounded-md bg-slate-100 p-3 font-mono text-xs text-slate-700">
        {API_BASE_URL}
      </p>
    </div>
  );

  useEffect(() => {
    if (!menuCode) {
      return;
    }

    const closeFloatingControls = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest("[data-floating-control]")) {
        return;
      }

      setMenuCode(null);
      setDeleteCode(null);
    };

    document.addEventListener("pointerdown", closeFloatingControls);

    return () => {
      document.removeEventListener("pointerdown", closeFloatingControls);
    };
  }, [menuCode]);

  const loadUrls = useCallback(async (transform?: UrlListTransform) => {
    const fetchId = latestFetchId.current + 1;
    latestFetchId.current = fetchId;
    setError(null);

    const items = await fetchGuestUrls(guestToken);
    const nextItems = transform ? transform(items) : items;

    if (fetchId === latestFetchId.current) {
      setUrls(nextItems);
    }

    return nextItems;
  }, [guestToken]);

  const refreshUrlsAfterMutation = useCallback(async (transform?: UrlListTransform) => {
    await loadUrls(transform);
    setMenuCode(null);
    setDeleteCode(null);
  }, [loadUrls]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    loadUrls()
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load guest URLs.");
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
    setCreateError(null);
    setRowMessage(null);
    setIsCreating(true);

    try {
      const createdUrl = await createGuestShortUrlForToken(guestToken, {
        original_url: originalUrl,
      });

      await refreshUrlsAfterMutation((items) => {
        if (items.some((item) => item.short_code === createdUrl.short_code)) {
          return items;
        }

        return [createdUrl, ...items];
      });
      setOriginalUrl("");
      setRowMessage({ shortCode: createdUrl.short_code, message: "Created", tone: "success" });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to create URL.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (url: ShortUrl) => {
    try {
      await navigator.clipboard.writeText(buildShortUrl(url.short_code));
      setCopiedId(url.id);
      setRowMessage({ shortCode: url.short_code, message: "Copied", tone: "success" });
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setRowMessage({
        shortCode: url.short_code,
        message: "Unable to copy the short URL.",
        tone: "error",
      });
    }
  };

  const handleDelete = async (shortCode: string) => {
    setActionCode(shortCode);
    setCreateError(null);
    setRowMessage(null);

    try {
      await deleteGuestShortUrl(guestToken, shortCode);
      await refreshUrlsAfterMutation((items) =>
        items.filter((item) => item.short_code !== shortCode),
      );
    } catch (err) {
      setRowMessage({
        shortCode,
        message: err instanceof Error ? err.message : "Unable to delete URL.",
        tone: "error",
      });
    } finally {
      setActionCode(null);
    }
  };

  return (
    <section className="-mt-3 space-y-4">
      <div className="page-header">
        <div>
          <p className="eyebrow">Guest dashboard</p>
          <h1 className="page-title">Manage guest links</h1>
          <p className="page-copy">
            Guest links expire after 7 days. Sign in to create custom links, choose your own expiration, keep links forever, and activate or deactivate links later.
          </p>
        </div>
        <Link className="btn-secondary self-start" to="/login">
          Sign in
        </Link>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <form className="panel panel-body flex h-full flex-col" onSubmit={handleCreate}>
            <div>
              <h2 className="text-lg font-semibold text-ink">Create a short URL</h2>
              <p className="mt-1 text-sm text-slate-500">
                The backend sets each guest link to expire in 7 days.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {createError && <div className="alert-error">{createError}</div>}

              <label className="field-label" htmlFor="guest-original-url">
                Original URL
                <input
                  id="guest-original-url"
                  type="url"
                  value={originalUrl}
                  onChange={(event) => setOriginalUrl(event.target.value)}
                  className="field-input"
                  placeholder="https://example.com/article"
                  required
                />
              </label>
            </div>

            <div className="mt-auto flex justify-end pt-4">
              <button type="submit" disabled={isCreating} className="btn-accent sm:min-w-28">
                {isCreating ? "Creating..." : "Create"}
              </button>
            </div>
          </form>

          <aside className="flex h-full flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              <article className="panel panel-body">
                <p className="text-sm font-medium text-slate-500">Total links</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{urls.length}</p>
              </article>
              <article className="panel panel-body">
                <p className="text-sm font-medium text-slate-500">Active links</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{activeCount}</p>
              </article>
            </div>

            <div className="hidden flex-1 xl:flex">
              {apiConnectionCard}
            </div>
          </aside>
        </div>

        <div className="panel panel-body">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Guest links</h2>
              <p className="mt-1 text-sm text-slate-500">
                Links are tied to this browser until they expire or you delete them.
              </p>
            </div>
            <p className="text-sm font-medium text-slate-500">{urls.length} total</p>
          </div>

          <div className="mt-5">
            {isLoading && <div className="skeleton h-36 w-full" />}

            {error && <div className="alert-error">{error}</div>}

            {!isLoading && !error && sortedUrls.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-base font-semibold text-ink">No guest links yet</p>
                <p className="mt-2 text-sm text-slate-500">Create a short link above to keep it with this guest browser.</p>
              </div>
            )}

            {!isLoading && !error && sortedUrls.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200 overflow-visible">
                  {sortedUrls.map((url) => (
                    <article key={url.id} className="relative px-4 py-4">
                      <div className="pr-12">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                              Active
                            </span>
                            <span className="font-mono text-xs text-slate-500">{url.short_code}</span>
                            {rowMessage?.shortCode === url.short_code && (
                              <span
                                className={[
                                  "text-xs font-semibold",
                                  rowMessage.tone === "success" ? "text-blue-700" : "text-red-700",
                                ].join(" ")}
                              >
                                {rowMessage.message}
                              </span>
                            )}
                            {actionCode === url.short_code && (
                              <span className="text-xs font-semibold text-blue-700">Saving changes...</span>
                            )}
                          </div>

                          <div className="mt-3 grid items-start gap-4 md:grid-cols-[220px_380px_240px] md:gap-4">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Original URL
                              </p>
                              <p className="mt-2 truncate text-sm font-semibold leading-[1.7rem] text-slate-800" title={url.original_url}>
                                {url.original_url}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Short URL
                              </p>
                              <div className="mt-2 flex min-w-0 items-center gap-2">
                                <a
                                  className="min-w-0 truncate font-mono text-sm text-mint hover:text-blue-700"
                                  href={buildOpenShortUrl(url.short_code)}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={buildShortUrl(url.short_code)}
                                >
                                  {buildShortUrl(url.short_code)}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(url)}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100"
                                  title="Copy short URL"
                                  aria-label="Copy short URL"
                                >
                                  {copiedId === url.id ? (
                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                      <path
                                        d="m5 10 3 3 7-7"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  ) : (
                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                      <rect
                                        x="7"
                                        y="5"
                                        width="9"
                                        height="11"
                                        rx="2"
                                        stroke="currentColor"
                                        strokeWidth="1.7"
                                      />
                                      <path
                                        d="M4 12V6a2 2 0 0 1 2-2h6"
                                        stroke="currentColor"
                                        strokeWidth="1.7"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Expiration
                              </p>
                              <p className="mt-2 text-sm font-semibold leading-[1.7rem] text-slate-800">
                                {formatDateET(url.expires_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="absolute right-4 top-4" data-floating-control>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteCode(null);
                            setMenuCode(menuCode === url.short_code ? null : url.short_code);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100"
                          title="More actions"
                          aria-label="More actions"
                          aria-expanded={menuCode === url.short_code}
                        >
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <circle cx="10" cy="4.5" r="1.5" />
                            <circle cx="10" cy="10" r="1.5" />
                            <circle cx="10" cy="15.5" r="1.5" />
                          </svg>
                        </button>

                        {menuCode === url.short_code && (
                          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-soft sm:left-full sm:right-auto sm:top-0 sm:ml-2 sm:mt-0">
                            <Link
                              className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                              to={`/guest/analytics/${encodeURIComponent(url.short_code)}`}
                              onClick={() => setMenuCode(null)}
                            >
                              Analytics
                            </Link>
                            <button
                              type="button"
                              disabled={actionCode === url.short_code}
                              onClick={() => {
                                if (deleteCode === url.short_code) {
                                  void handleDelete(url.short_code);
                                  return;
                                }

                                setDeleteCode(url.short_code);
                              }}
                              className={[
                                "block w-full rounded-md px-3 py-2 text-left text-sm font-semibold disabled:cursor-not-allowed",
                                deleteCode === url.short_code
                                  ? "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300"
                                  : "text-red-700 hover:bg-red-50",
                              ].join(" ")}
                            >
                              {isDeleting(url.short_code)
                                ? "Deleting..."
                                : deleteCode === url.short_code
                                  ? "Confirm delete"
                                  : "Delete"}
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="xl:hidden">
          {apiConnectionCard}
        </div>
      </div>
    </section>
  );
}
