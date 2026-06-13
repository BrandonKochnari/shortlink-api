import { API_BASE_URL } from "./config";

export type ShortUrl = {
  id: number;
  original_url: string;
  short_code: string;
  short_url: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

export type CreateUrlInput = {
  original_url: string;
  expires_at?: string;
};

export type UrlAnalytics = {
  short_code: string;
  original_url: string;
  clicks: number;
  created_at: string;
  last_clicked: string | null;
  is_active: boolean;
  expires_at: string | null;
  is_expired: boolean;
};

export type AnalyticsRange = "1d" | "7d" | "30d" | "90d";

export type AnalyticsPoint = {
  period_start: string;
  clicks: number;
};

export type UrlAnalyticsTimeseries = {
  range: AnalyticsRange;
  points: AnalyticsPoint[];
};

export type UpdateUrlInput = {
  expires_at: string | null;
};

function getPublicBaseUrl() {
  return window.location.origin.replace(/\/$/, "");
}

export function buildShortUrl(shortCode: string) {
  return `${getPublicBaseUrl()}/${encodeURIComponent(shortCode)}`;
}

export function buildOpenShortUrl(shortCode: string) {
  return `${buildShortUrl(shortCode)}?_open=${Date.now()}`;
}

type ApiErrorBody = {
  detail?: string | { msg?: string }[];
  message?: string;
};

async function parseError(response: Response) {
  let message = `${response.status} ${response.statusText}`.trim();

  try {
    const body = (await response.json()) as ApiErrorBody;
    if (typeof body.detail === "string") {
      message = body.detail;
    } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      message = body.detail[0].msg;
    } else if (body.message) {
      message = body.message;
    }
  } catch {
    // Keep the HTTP status message when the API does not return JSON.
  }

  return new Error(message || "Request failed");
}

async function request<T>(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

async function publicRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export function fetchMyUrls(token: string) {
  return request<ShortUrl[]>(`/api/v1/urls/my-urls?_=${Date.now()}`, token, {
    cache: "no-store",
  });
}

export function createShortUrl(token: string, input: CreateUrlInput) {
  return request<ShortUrl>("/api/v1/urls/", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

function guestHeaders(guestToken: string) {
  return {
    "X-Guest-Token": guestToken,
  };
}

export function fetchGuestUrls(guestToken: string) {
  return publicRequest<ShortUrl[]>(`/api/v1/urls/guest?_=${Date.now()}`, {
    headers: guestHeaders(guestToken),
  });
}

export function createGuestShortUrlForToken(
  guestToken: string,
  input: Pick<CreateUrlInput, "original_url">,
) {
  return publicRequest<ShortUrl>("/api/v1/urls/guest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...guestHeaders(guestToken),
    },
    body: JSON.stringify(input),
  });
}

export function deleteGuestShortUrl(guestToken: string, shortCode: string) {
  return publicRequest<{ message: string }>(
    `/api/v1/urls/guest/${encodeURIComponent(shortCode)}`,
    {
      method: "DELETE",
      headers: guestHeaders(guestToken),
    },
  );
}

export function fetchGuestUrlAnalytics(guestToken: string, shortCode: string) {
  return publicRequest<UrlAnalytics>(
    `/api/v1/urls/guest/${encodeURIComponent(shortCode)}/analytics`,
    {
      headers: guestHeaders(guestToken),
    },
  );
}

export function fetchUrlAnalytics(token: string, shortCode: string) {
  return request<UrlAnalytics>(
    `/api/v1/urls/${encodeURIComponent(shortCode)}/analytics`,
    token,
  );
}

export function fetchUrlAnalyticsTimeseries(
  token: string,
  shortCode: string,
  range: AnalyticsRange,
) {
  return request<UrlAnalyticsTimeseries>(
    `/api/v1/urls/${encodeURIComponent(shortCode)}/analytics/timeseries?range=${range}`,
    token,
  );
}

export function fetchGuestUrlAnalyticsTimeseries(
  guestToken: string,
  shortCode: string,
  range: AnalyticsRange,
) {
  return publicRequest<UrlAnalyticsTimeseries>(
    `/api/v1/urls/guest/${encodeURIComponent(shortCode)}/analytics/timeseries?range=${range}`,
    {
      headers: guestHeaders(guestToken),
    },
  );
}

export function updateShortUrl(token: string, shortCode: string, input: UpdateUrlInput) {
  return request<{ message: string; expires_at: string | null }>(
    `/api/v1/urls/${encodeURIComponent(shortCode)}/expiration`,
    token,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export function activateShortUrl(token: string, shortCode: string) {
  return request<{ message: string; short_code: string }>(
    `/api/v1/urls/${encodeURIComponent(shortCode)}/activate`,
    token,
    {
      method: "PATCH",
    },
  );
}

export function deactivateShortUrl(token: string, shortCode: string) {
  return request<{ message: string; short_code: string }>(
    `/api/v1/urls/${encodeURIComponent(shortCode)}/deactivate`,
    token,
    {
      method: "PATCH",
    },
  );
}

export function deleteShortUrl(token: string, shortCode: string) {
  return request<{ message: string }>(
    `/api/v1/urls/${encodeURIComponent(shortCode)}`,
    token,
    {
      method: "DELETE",
    },
  );
}
