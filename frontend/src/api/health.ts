import { API_BASE_URL } from "./config";

const HEALTH_CHECK_TIMEOUT_MS = 5000;

export async function checkApiHealth(signal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  const abortHealthCheck = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", abortHealthCheck, { once: true });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error("API is not ready yet.");
    }
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortHealthCheck);
  }
}
