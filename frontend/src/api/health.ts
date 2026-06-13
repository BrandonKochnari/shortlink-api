import { API_BASE_URL } from "./config";

export async function checkApiHealth(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/`, {
    cache: "no-store",
    signal,
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error("API is not ready yet.");
  }
}
