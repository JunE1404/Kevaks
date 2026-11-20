// Base URL for every backend call.
//
// Dev: same-origin "/api", rewritten and proxied to the local backend by the
// Vite dev server (see vite.config.ts).
// Build: the absolute API origin, so the statically served frontend can reach
// the API cross-origin. Override with VITE_API_URL if the host changes.
export const API_BASE: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "/api" : "https://api.kevaks.com");
