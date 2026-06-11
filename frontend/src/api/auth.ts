import { API_BASE_URL } from "./config";

export type AuthUser = {
  id: number;
  email: string;
  created_at?: string;
};

type TokenResponse = {
  access_token: string;
  token_type?: string;
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

async function request<T>(path: string, init: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export function registerUser(email: string, password: string) {
  return request<AuthUser>("/api/v1/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
}

export function loginUser(email: string, password: string) {
  const formData = new URLSearchParams();
  formData.set("username", email);
  formData.set("password", password);

  return request<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
  });
}

export function getCurrentUser(token: string) {
  return request<AuthUser>("/api/v1/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
