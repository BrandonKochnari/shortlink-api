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
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [actionCode, setActionCode] = useState<string | null>(null);
  const [editExpiresAtByCode, setEditExpiresAtByCode] = useState<Record<string, string>>({});
  const [expirationPickerCode, setExpirationPickerCode] = useState<string | null>(null);
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
  const expiringCount = urls.filter((url) => url.expires_at).length;

  const clearTransientState = useCallback(() => {
    setDeleteCode(null);
    setMenuCode(null);
    setExpirationPickerCode(null);
  }, []);

  useEffect(() => {
    if (!menuCode && !expirationPickerCode) {
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
      setExpirationPickerCode(null);
    };

    document.addEventListener("pointerdown", closeFloatingControls);

    return () => {
      document.removeEventListener("pointerdown", closeFloatingControls);
    };
  }, [expirationPickerCode, menuCode]);

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
    clearTransientState();
  }, [clearTransientState, loadUrls]);

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
    setRowMessage(null);
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
      setRowMessage({ shortCode: createdUrl.short_code, message: "Created", tone: "success" });
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

  const handleUpdate = async (shortCode: string, nextValue?: string) => {
    if (!token) {
      return;
    }

    setActionCode(shortCode);
    setCreateError(null);
    setRowMessage(null);

    try {
      const editExpiresAt = nextValue ?? editExpiresAtByCode[shortCode] ?? "";
      const nextExpiresAt = editExpiresAt ? toApiDateTime(editExpiresAt) ?? null : null;
      await updateShortUrl(token, shortCode, {
        expires_at: nextExpiresAt,
      });
      await refreshUrlsAfterMutation((items) =>
        items.map((item) =>
          item.short_code === shortCode ? { ...item, expires_at: nextExpiresAt } : item,
        ),
      );
      setRowMessage({ shortCode, message: nextExpiresAt ? "Expiration updated" : "Expiration cleared", tone: "success" });
    } catch (err) {
      setRowMessage({
        shortCode,
        message: err instanceof Error ? err.message : "Unable to update URL.",
        tone: "error",
      });
    } finally {
      setActionCode(null);
    }
  };

  const updateExpirationDraft = (url: ShortUrl, value: string) => {
    setEditExpiresAtByCode((currentValues) => ({
      ...currentValues,
      [url.short_code]: value,
    }));
    setCreateError(null);
    setRowMessage(null);

    if (!value || !Number.isNaN(new Date(value).getTime())) {
      void handleUpdate(url.short_code, value);
    }
  };

  const getExpirationDraft = (url: ShortUrl) =>
    editExpiresAtByCode[url.short_code] ?? toDateTimeLocalInput(url.expires_at);

  const handleToggleActive = async (url: ShortUrl) => {
    if (!token) {
      return;
    }

    setActionCode(url.short_code);
    setCreateError(null);
    setRowMessage(null);

    try {
      if (url.is_active) {
        await deactivateShortUrl(token, url.short_code);
        await refreshUrlsAfterMutation((items) =>
          items.map((item) =>
            item.short_code === url.short_code ? { ...item, is_active: false } : item,
          ),
        );
        setRowMessage({ shortCode: url.short_code, message: "Deactivated", tone: "success" });
      } else {
        await activateShortUrl(token, url.short_code);
        await refreshUrlsAfterMutation((items) =>
          items.map((item) =>
            item.short_code === url.short_code ? { ...item, is_active: true } : item,
          ),
        );
        setRowMessage({ shortCode: url.short_code, message: "Activated", tone: "success" });
      }
    } catch (err) {
      setRowMessage({
        shortCode: url.short_code,
        message: err instanceof Error ? err.message : "Unable to change URL status.",
        tone: "error",
      });
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
    setRowMessage(null);

    try {
      await deleteShortUrl(token, shortCode);
      await refreshUrlsAfterMutation((items) =>
        items.filter((item) => item.short_code !== shortCode),
      );
      setRowMessage(null);
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
          <p className="eyebrow">Dashboard</p>
          <h1 className="page-title">Manage short links</h1>
          <p className="page-copy">Create, update, copy, and inspect analytics for your shortened URLs.</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <form className="panel panel-body flex h-full flex-col" onSubmit={handleCreate}>
            <div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Create a short URL</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The short code is generated automatically.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {createError && <div className="alert-error">{createError}</div>}
            </div>

            <div className="mt-4 grid gap-3">
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

            <div className="panel panel-body flex-1">
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
                  Copy, analyze, and manage each short link.
                </p>
              </div>
              <p className="text-sm font-medium text-slate-500">
                {urls.length} total / {expiringCount} with expiration
              </p>
            </div>

            <div className="mt-5">
              {isLoading && <UrlSkeleton />}

              {error && <div className="alert-error">{error}</div>}

              {!isLoading && !error && sortedUrls.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-base font-semibold text-ink">No short URLs yet</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Create your first short link above. It will appear here with copy and analytics actions.
                  </p>
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
                              <span
                                className={[
                                  "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
                                  url.is_active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600",
                                ].join(" ")}
                              >
                                {url.is_active ? "Active" : "Inactive"}
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
                            </div>

                            <div className="mt-3 grid items-start gap-4 md:grid-cols-[220px_380px_150px] md:gap-4">
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
                                <div className="mt-1 flex min-w-0 items-center gap-2">
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

                              <div className="relative w-36" data-floating-control>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Expiration
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuCode(null);
                                    setDeleteCode(null);
                                    setExpirationPickerCode(
                                      expirationPickerCode === url.short_code ? null : url.short_code,
                                    );
                                  }}
                                  className="mt-1 flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <span className="truncate">{url.expires_at ? formatDateET(url.expires_at) : "Date"}</span>
                                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                    <path
                                      d="m6 8 4 4 4-4"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>

                                {expirationPickerCode === url.short_code && (
                                  <div className="absolute left-1/2 z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
                                    <label
                                      className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                                      htmlFor={`edit-expires-${url.id}`}
                                    >
                                      Choose date
                                      <input
                                        id={`edit-expires-${url.id}`}
                                        type="datetime-local"
                                        value={getExpirationDraft(url)}
                                        onChange={(event) => updateExpirationDraft(url, event.target.value)}
                                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink outline-none ring-mint transition focus:border-mint focus:ring-2"
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => updateExpirationDraft(url, "")}
                                      className="mt-2 text-sm font-semibold text-slate-600 hover:text-ink"
                                    >
                                      Clear expiration
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="absolute right-4 top-4" data-floating-control>
                          <button
                            type="button"
                            onClick={() => {
                              setExpirationPickerCode(null);
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
                            <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-soft">
                              <Link
                                className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                to={`/analytics/${encodeURIComponent(url.short_code)}`}
                                onClick={() => setMenuCode(null)}
                              >
                                Analytics
                              </Link>
                              <button
                                type="button"
                                disabled={actionCode === url.short_code}
                                onClick={() => handleToggleActive(url)}
                                className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                              >
                                {url.is_active ? "Deactivate" : "Activate"}
                              </button>
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
                                {actionCode === url.short_code
                                  ? "Deleting..."
                                  : deleteCode === url.short_code
                                    ? "Confirm delete"
                                    : "Delete"}
                              </button>
                            </div>
                          )}
                        </div>

                        {actionCode === url.short_code && (
                          <p className="mt-3 text-xs font-medium text-slate-500">Saving changes...</p>
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
