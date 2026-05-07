const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim();
const devFallback = "http://localhost:5000";

function normalize(url) {
  return url.replace(/\/+$/, "");
}

if (import.meta.env.PROD && !rawApiUrl) {
  throw new Error("Missing VITE_API_URL in production build.");
}

export const API_BASE_URL = normalize(rawApiUrl || devFallback);

