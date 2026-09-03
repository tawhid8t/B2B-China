const EXTENSION_AUTH_STORAGE_KEY = "extensionCredential";

async function extensionApiFetch(path, options = {}) {
  const { apiBaseUrl = "http://localhost:3000", [EXTENSION_AUTH_STORAGE_KEY]: credential } = await chrome.storage.local.get(["apiBaseUrl", EXTENSION_AUTH_STORAGE_KEY]);
  if (!credential) {
    const error = new Error("Connect an extension credential first.");
    error.code = "AUTH_REQUIRED";
    throw error;
  }
  let response;
  try {
    response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${credential}` },
    });
  } catch {
    const error = new Error("Unable to reach the BridgeCart backend.");
    error.code = "NETWORK_ERROR";
    throw error;
  }
  if (response.status === 401) { const error = new Error("Extension credential is invalid, expired, or revoked."); error.code = "AUTH_REQUIRED"; throw error; }
  if (response.status === 403) { const error = new Error("Extension credential is not authorized."); error.code = "FORBIDDEN"; throw error; }
  return response;
}
