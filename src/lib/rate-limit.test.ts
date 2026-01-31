
import { describe, it, expect } from 'vitest'
import { rateLimit, RateLimitConfig } from '@/lib/rate-limit'

describe('Rate Limiter', () => {
    const testConfig: RateLimitConfig = {
        maxRequests: 5,
        windowMs: 1000 // 1 second
    }

    it('should allow requests under the limit', () => {
        const id = `test-${Date.now()}`

        for (let i = 0; i < 5; i++) {
            const result = rateLimit(id, testConfig)
            expect(result.success).toBe(true)
            expect(result.remaining).toBe(4 - i)
        }
    })

    it('should block requests over the limit', () => {
        const id = `test-block-${Date.now()}`

        // Exhaust the limit
        for (let i = 0; i < 5; i++) {
            rateLimit(id, testConfig)
        }

        // 6th request should be blocked
        const result = rateLimit(id, testConfig)
        expect(result.success).toBe(false)
        expect(result.remaining).toBe(0)
    })

    it('should reset after window expires', async () => {
        const shortConfig: RateLimitConfig = {
            maxRequests: 2,
            windowMs: 100 // 100ms
        }
        const id = `test-reset-${Date.now()}`

        // Exhaust
        rateLimit(id, shortConfig)
        rateLimit(id, shortConfig)
        expect(rateLimit(id, shortConfig).success).toBe(false)

        // Wait for window to expire
        await new Promise(resolve => setTimeout(resolve, 150))

        // Should be allowed again
        const result = rateLimit(id, shortConfig)
        expect(result.success).toBe(true)
    })
})
