const DEFAULT_API_BASE_URL = "https://shortlink-api-4ubx.onrender.com";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || DEFAULT_API_BASE_URL;
