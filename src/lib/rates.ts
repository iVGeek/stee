const FALLBACK_USD_TO_KES = 129;
const TTL_MS = 30 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

let cachedRate: number | null = null;
let cachedAt = 0;
let lastAttempt = 0;

/**
 * Live USD -> KES exchange rate for display purposes only.
 * Fetches from open.er-api.com and caches for 30 minutes; falls back to the
 * cached value (or a static fallback) if the fetch fails, so the public
 * config route never blocks on the exchange API.
 */
export async function getUsdToKesRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate !== null && now - cachedAt < TTL_MS) return cachedRate;
  // Don't hammer the API if it keeps failing.
  if (now - lastAttempt < REFRESH_COOLDOWN_MS && cachedRate !== null) return cachedRate;

  lastAttempt = now;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const rate = Number(json?.rates?.KES);
    if (json?.result === "success" && Number.isFinite(rate) && rate > 0) {
      cachedRate = rate;
      cachedAt = now;
      return rate;
    }
  } catch {
    // Transient network failure — fall through to cache/fallback.
  }
  if (cachedRate !== null) return cachedRate;
  return FALLBACK_USD_TO_KES;
}
