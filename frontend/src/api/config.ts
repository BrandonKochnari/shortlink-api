const DEFAULT_API_BASE_URL = "https://shortlink-api-1.onrender.com";

declare global {
  interface Window {
    __SHORTLINK_CONFIG__?: {
      API_BASE_URL?: string;
    };
  }
}

function normalizeBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/$/, "");
}

export const API_BASE_URL =
  normalizeBaseUrl(window.__SHORTLINK_CONFIG__?.API_BASE_URL) ||
  normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL) ||
  normalizeBaseUrl(import.meta.env.VITE_API_URL) ||
  DEFAULT_API_BASE_URL;
