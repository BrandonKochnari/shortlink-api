import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildOpenShortUrl,
  buildShortUrl,
  createGuestShortUrl,
  ShortUrl,
} from "../api/urls";
import { formatDateET } from "../lib/formatDate";

const GUEST_LINKS_STORAGE_KEY = "guest_short_links";

function loadGuestLinks() {
  try {
    const storedValue = sessionStorage.getItem(GUEST_LINKS_STORAGE_KEY);
    if (!storedValue) {
      return [];
    }

    return JSON.parse(storedValue) as ShortUrl[];
  } catch {
    return [];
  }
}

function saveGuestLinks(urls: ShortUrl[]) {
  sessionStorage.setItem(GUEST_LINKS_STORAGE_KEY, JSON.stringify(urls));
}

export function GuestDashboard() {
  const [urls, setUrls] = useState<ShortUrl[]>(() => loadGuestLinks());
  const [originalUrl, setOriginalUrl] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<{ shortCode: string; message: string; tone: "success" | "error" } | null>(null);

  const sortedUrls = useMemo(
    () =>
      [...urls].sort(
        (first, second) =>
          new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
      ),
    [urls],
  );

  const setStoredUrls = (nextUrls: ShortUrl[]) => {
    setUrls(nextUrls);
    saveGuestLinks(nextUrls);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    setRowMessage(null);
    setIsCreating(true);

    try {
      const createdUrl = await createGuestShortUrl({
        original_url: originalUrl,
      });
      const nextUrls = [createdUrl, ...urls.filter((url) => url.short_code !== createdUrl.short_code)];
      setStoredUrls(nextUrls);
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

  const handleDelete = (shortCode: string) => {
    setStoredUrls(urls.filter((url) => url.short_code !== shortCode));
    setRowMessage(null);
  };

  return (
    <section className="-mt-3 space-y-4">
      <div className="page-header">
        <div>
          <p className="eyebrow">Guest</p>
          <h1 className="page-title">Create short links</h1>
          <p className="page-copy">Guest links expire after one week.</p>
        </div>
        <Link className="btn-secondary self-start" to="/login">
          Sign in
        </Link>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-5">
        <form className="panel panel-body" onSubmit={handleCreate}>
          <div>
            <h2 className="text-lg font-semibold text-ink">Create a short URL</h2>
            <p className="mt-1 text-sm text-slate-500">The short code is generated automatically.</p>
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

          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={isCreating} className="btn-accent sm:min-w-28">
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>

        <div className="panel panel-body">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Guest links</h2>
              <p className="mt-1 text-sm text-slate-500">Only links from this browser session appear here.</p>
            </div>
            <p className="text-sm font-medium text-slate-500">{urls.length} total</p>
          </div>

          <div className="mt-5">
            {sortedUrls.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-base font-semibold text-ink">No guest links yet</p>
                <p className="mt-2 text-sm text-slate-500">Create a short link above to keep it in this session.</p>
              </div>
            )}

            {sortedUrls.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200">
                  {sortedUrls.map((url) => (
                    <article key={url.id} className="px-4 py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
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
                          </div>

                          <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Original URL
                              </p>
                              <p className="mt-2 truncate text-sm font-semibold text-slate-800" title={url.original_url}>
                                {url.original_url}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Short URL
                              </p>
                              <a
                                className="mt-2 block truncate font-mono text-sm text-mint hover:text-blue-700"
                                href={buildOpenShortUrl(url.short_code)}
                                target="_blank"
                                rel="noreferrer"
                                title={buildShortUrl(url.short_code)}
                              >
                                {buildShortUrl(url.short_code)}
                              </a>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Expires
                              </p>
                              <p className="mt-2 text-sm font-semibold text-slate-800">
                                {url.expires_at ? formatDateET(url.expires_at) : "One week"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(url)}
                            className="btn-secondary"
                          >
                            {copiedId === url.id ? "Copied" : "Copy"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(url.short_code)}
                            className="btn-coral"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
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
