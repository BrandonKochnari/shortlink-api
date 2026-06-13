const DEFAULT_API_BASE_URL = "https://shortlink-c8sm.onrender.com";
const LOCAL_API_BASE_URL = "http://127.0.0.1:8000";

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

function isLocalHost() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

const runtimeConfigUrl = normalizeBaseUrl(window.__SHORTLINK_CONFIG__?.API_BASE_URL);
const viteConfigUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

export const API_BASE_URL =
  (isLocalHost() ? viteConfigUrl || LOCAL_API_BASE_URL : runtimeConfigUrl) ||
  viteConfigUrl ||
  DEFAULT_API_BASE_URL;
