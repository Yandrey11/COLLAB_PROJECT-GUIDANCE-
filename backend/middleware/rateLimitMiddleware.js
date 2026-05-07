import rateLimit from "express-rate-limit";

const HEALTH_PATHS = new Set(["/", "/health", "/api/health"]);

const isPreflight = (req) => req.method === "OPTIONS";
const isHealth = (req) => HEALTH_PATHS.has(req.path);

const build429Payload = (message) => ({
  success: false,
  code: "RATE_LIMITED",
  message,
});

const createLimiter = ({
  windowMs,
  max,
  message,
  skip,
  standardHeaders = true,
  legacyHeaders = false,
} = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders,
    legacyHeaders,
    skip:
      skip ||
      ((req) => {
        if (isPreflight(req) || isHealth(req)) return true;
        return false;
      }),
    handler: (req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        ...build429Payload(message || "Too many requests. Please try again later."),
        retryAfterSeconds: retryAfter,
      });
    },
  });

/**
 * Conservative defaults:
 * - Global API limit is intentionally generous for normal usage.
 * - Auth and sensitive write routes use tighter windows.
 */
export const RATE_LIMITS = {
  globalApi: { windowMs: 60 * 1000, max: 240 },
  auth: { windowMs: 15 * 60 * 1000, max: 20 },
  strictAuth: { windowMs: 15 * 60 * 1000, max: 10 },
  sensitiveWrite: { windowMs: 60 * 1000, max: 45 },
  upload: { windowMs: 60 * 1000, max: 20 },
};

export const globalApiLimiter = createLimiter({
  ...RATE_LIMITS.globalApi,
  message: "Too many API requests. Please slow down and try again shortly.",
});

export const authLimiter = createLimiter({
  ...RATE_LIMITS.auth,
  message: "Too many authentication attempts. Please wait and try again.",
});

export const strictAuthLimiter = createLimiter({
  ...RATE_LIMITS.strictAuth,
  message: "Too many login attempts. Please wait before trying again.",
});

export const sensitiveWriteLimiter = createLimiter({
  ...RATE_LIMITS.sensitiveWrite,
  message: "Too many write requests. Please try again in a moment.",
});

export const uploadLimiter = createLimiter({
  ...RATE_LIMITS.upload,
  message: "Too many upload attempts. Please try again in a moment.",
});

export { createLimiter };
