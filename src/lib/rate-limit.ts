
// Simple in-memory rate limiter
// For production, use Redis (Upstash) or Vercel's built-in rate limiting

interface RateLimitEntry {
    count: number
    resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
    maxRequests: number  // Max requests per window
    windowMs: number     // Time window in milliseconds
}

export function rateLimit(
    identifier: string,
    config: RateLimitConfig
): { success: boolean; remaining: number; resetIn: number } {
    const now = Date.now()
    const entry = rateLimitStore.get(identifier)

    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up on each call
        for (const [key, value] of rateLimitStore.entries()) {
            if (now > value.resetTime) {
                rateLimitStore.delete(key)
            }
        }
    }

    if (!entry || now > entry.resetTime) {
        // Create new entry
        rateLimitStore.set(identifier, {
            count: 1,
            resetTime: now + config.windowMs
        })
        return {
            success: true,
            remaining: config.maxRequests - 1,
            resetIn: config.windowMs
        }
    }

    if (entry.count >= config.maxRequests) {
        return {
            success: false,
            remaining: 0,
            resetIn: entry.resetTime - now
        }
    }

    // Increment count
    entry.count++
    rateLimitStore.set(identifier, entry)

    return {
        success: true,
        remaining: config.maxRequests - entry.count,
        resetIn: entry.resetTime - now
    }
}
