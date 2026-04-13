const buckets = new Map();

function prune(now) {
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function createRateLimiter({ windowMs, max, keyPrefix }) {
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    prune(now);

    const identifier = `${keyPrefix}:${req.ip || req.connection?.remoteAddress || 'unknown'}`;
    const current = buckets.get(identifier);

    if (!current || current.resetAt <= now) {
      buckets.set(identifier, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        message: 'Too many requests. Please try again later.',
        retryAfter,
      });
    }

    current.count += 1;
    buckets.set(identifier, current);
    return next();
  };
}

module.exports = {
  createRateLimiter,
};
