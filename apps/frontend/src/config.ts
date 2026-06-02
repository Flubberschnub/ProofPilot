type RuntimeConfig = {
  apiBaseUrl?: string;
};

declare global {
  interface Window {
    __PROOFPILOT_CONFIG__?: RuntimeConfig;
  }
}

export function apiUrl(path: string) {
  const baseUrl = window.__PROOFPILOT_CONFIG__?.apiBaseUrl
    ?? import.meta.env.VITE_API_BASE_URL
    ?? "http://localhost:8080";

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}
