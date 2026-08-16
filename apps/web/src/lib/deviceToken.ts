/**
 * Retrieves or creates a persistent deviceToken UUID stored in browser localStorage.
 * This identifies Tier 1 anonymous users across page reloads on the same browser.
 */
export function getOrCreateDeviceToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const STORAGE_KEY = "chatspin_device_token";
  let token = localStorage.getItem(STORAGE_KEY);

  if (!token || !isValidUuid(token)) {
    token = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, token);
  }

  return token;
}

function isValidUuid(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}
