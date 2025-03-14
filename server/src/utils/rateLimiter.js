const logger = require('./logger');

/**
 * Calculate backoff time with exponential strategy
 * @param {number} retryAfter - Suggested retry after time from API (seconds)
 * @param {number} attempt - Current attempt number (defaults to 1)
 * @returns {number} - Backoff time in milliseconds
 */
const calculateBackoff = (retryAfter = 30, attempt = 1) => {
  // Convert retryAfter to milliseconds
  const baseBackoff = retryAfter * 1000;
  
  // Apply exponential backoff with jitter
  const exponentialBackoff = baseBackoff * Math.pow(2, attempt - 1);
  
  // Add jitter (random value between 0-1000ms) to avoid thundering herd
  const jitter = Math.floor(Math.random() * 1000);
  
  const finalBackoff = exponentialBackoff + jitter;
  
  // Log the backoff time
  logger.debug(`Rate limit backoff: ${finalBackoff}ms (attempt ${attempt})`);
  
  // Cap the maximum backoff time at 5 minutes
  return Math.min(finalBackoff, 300000);
};

/**
 * Rate limiter middleware for Express
 * @param {Object} options - Rate limiter options
 * @returns {Function} - Express middleware
 */
const rateLimiterMiddleware = (options = {}) => {
  const {
    windowMs = 60 * 1000, // Default: 1 minute
    maxRequests = 60,     // Default: 60 requests per minute
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    keyGenerator = (req) => req.ip,
    skip = () => false
  } = options;
  
  // Store request counts in memory
  const requestCounts = new Map();
  
  // Clean up old entries every minute
  setInterval(() => {
    const now = Date.now();
    requestCounts.forEach((value, key) => {
      if (now - value.timestamp > windowMs) {
        requestCounts.delete(key);
      }
    });
  }, 60000);
  
  // Return the middleware function
  return (req, res, next) => {
    // Skip rate limiting if the skip function returns true
    if (skip(req)) {
      return next();
    }
    
    // Get the client identifier
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Get or create the request count
    const requestData = requestCounts.get(key) || { count: 0, timestamp: now };
    
    // Reset the count if the window has passed
    if (now - requestData.timestamp > windowMs) {
      requestData.count = 0;
      requestData.timestamp = now;
    }
    
    // Increment the request count
    requestData.count += 1;
    requestCounts.set(key, requestData);
    
    // Check if the client has exceeded the rate limit
    if (requestData.count > maxRequests) {
      logger.warn(`Rate limit exceeded for ${key}`);
      return res.status(statusCode).json({
        error: message,
        retryAfter: Math.ceil((requestData.timestamp + windowMs - now) / 1000)
      });
    }
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - requestData.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil((requestData.timestamp + windowMs) / 1000));
    
    next();
  };
};

module.exports = {
  calculateBackoff,
  rateLimiterMiddleware
};