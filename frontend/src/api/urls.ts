import { API_BASE_URL } from "./config";

export type ShortUrl = {
  id: number;
  original_url: string;
  short_code: string;
  short_url: string;
  expires_at: string | null;
  created_at: string;
};

export type CreateUrlInput = {
  original_url: string;
  custom_alias?: string;
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
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export function fetchMyUrls(token: string) {
  return request<ShortUrl[]>("/api/v1/urls/my-urls", token);
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

export function fetchUrlAnalytics(token: string, shortCode: string) {
  return request<UrlAnalytics>(
    `/api/v1/urls/${encodeURIComponent(shortCode)}/analytics`,
    token,
  );
}
