const GUEST_TOKEN_STORAGE_KEY = "guest_client_token";

function createGuestToken() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const randomValues = new Uint32Array(4);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (value) => value.toString(16).padStart(8, "0")).join("-");
}

export function getGuestToken() {
  const existingToken = localStorage.getItem(GUEST_TOKEN_STORAGE_KEY);

  if (existingToken) {
    return existingToken;
  }

  const nextToken = createGuestToken();
  localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, nextToken);
  return nextToken;
}
