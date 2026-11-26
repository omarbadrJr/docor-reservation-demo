const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_PER_PAIR = 5;
const DEFAULT_MAX_PER_IP = 15;
const MAX_TRACKED_BUCKETS = 1000;

export type RateLimitCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export interface LoginRateLimiter {
  check(ip: string, email: string, now?: number): RateLimitCheck;
  recordFailure(ip: string, email: string, now?: number): void;
  reset(ip: string, email: string): void;
}

export interface LoginRateLimiterOptions {
  windowMs?: number;
  maxPerPair?: number;
  maxPerIp?: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeIp(ip: string): string {
  return ip.trim() || "unknown";
}

function makePairKey(normalizedIp: string, normalizedEmail: string): string {
  // NUL separator prevents IPv6 colons from colliding with key delimiters.
  return `${normalizedIp}\0${normalizedEmail}`;
}

function pruneBucket(
  buckets: Map<string, number[]>,
  key: string,
  now: number,
  windowMs: number,
): number[] {
  const existing = buckets.get(key);
  if (!existing) {
    return [];
  }

  const cutoff = now - windowMs;
  const active = existing.filter((timestamp) => timestamp > cutoff && timestamp <= now);

  if (active.length === 0) {
    buckets.delete(key);
    return [];
  }

  if (active.length !== existing.length) {
    buckets.set(key, active);
  }

  return active;
}

function sweepExpiredBuckets(buckets: Map<string, number[]>, cutoff: number): void {
  for (const [key, timestamps] of buckets.entries()) {
    const active = timestamps.filter((timestamp) => timestamp > cutoff);
    if (active.length === 0) {
      buckets.delete(key);
    } else if (active.length !== timestamps.length) {
      buckets.set(key, active);
    }
  }
}

/**
 * Creates an in-memory sliding-window rate limiter tracking failed login
 * attempts per `(ip, email)` pair and per `ip` address.
 */
export function createLoginRateLimiter(
  options?: LoginRateLimiterOptions,
): LoginRateLimiter {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxPerPair = options?.maxPerPair ?? DEFAULT_MAX_PER_PAIR;
  const maxPerIp = options?.maxPerIp ?? DEFAULT_MAX_PER_IP;

  const pairBuckets = new Map<string, number[]>();
  const ipBuckets = new Map<string, number[]>();

  return {
    check(ip: string, email: string, now = Date.now()): RateLimitCheck {
      const normalizedIp = normalizeIp(ip);
      const normalizedEmail = normalizeEmail(email);
      const pairKey = makePairKey(normalizedIp, normalizedEmail);

      const pairHits = pruneBucket(pairBuckets, pairKey, now, windowMs);
      const ipHits = pruneBucket(ipBuckets, normalizedIp, now, windowMs);

      const pairBlocked = pairHits.length >= maxPerPair;
      const ipBlocked = ipHits.length >= maxPerIp;

      if (!pairBlocked && !ipBlocked) {
        return { allowed: true };
      }

      let retryAt = 0;
      if (pairBlocked) {
        const oldestBlockingPairHit = pairHits[pairHits.length - maxPerPair];
        if (oldestBlockingPairHit !== undefined) {
          retryAt = Math.max(retryAt, oldestBlockingPairHit + windowMs);
        }
      }
      if (ipBlocked) {
        const oldestBlockingIpHit = ipHits[ipHits.length - maxPerIp];
        if (oldestBlockingIpHit !== undefined) {
          retryAt = Math.max(retryAt, oldestBlockingIpHit + windowMs);
        }
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((retryAt - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    },

    recordFailure(ip: string, email: string, now = Date.now()): void {
      const normalizedIp = normalizeIp(ip);
      const normalizedEmail = normalizeEmail(email);
      const pairKey = makePairKey(normalizedIp, normalizedEmail);
      const cutoff = now - windowMs;

      if (pairBuckets.size > MAX_TRACKED_BUCKETS) {
        sweepExpiredBuckets(pairBuckets, cutoff);
      }
      if (ipBuckets.size > MAX_TRACKED_BUCKETS) {
        sweepExpiredBuckets(ipBuckets, cutoff);
      }

      const pairHits = pruneBucket(pairBuckets, pairKey, now, windowMs);
      pairHits.push(now);
      pairBuckets.set(pairKey, pairHits);

      const ipHits = pruneBucket(ipBuckets, normalizedIp, now, windowMs);
      ipHits.push(now);
      ipBuckets.set(normalizedIp, ipHits);
    },

    reset(ip: string, email: string): void {
      const normalizedIp = normalizeIp(ip);
      const normalizedEmail = normalizeEmail(email);
      pairBuckets.delete(makePairKey(normalizedIp, normalizedEmail));
    },
  };
}

export const loginRateLimiter = createLoginRateLimiter();

/**
 * Extracts the client IP address from common proxy headers, falling back to `"unknown"`.
 */
export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstEntry = forwardedFor.split(",")[0]?.trim();
    if (firstEntry) {
      return firstEntry;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return "unknown";
}
