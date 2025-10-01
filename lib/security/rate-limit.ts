import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

interface RateLimitRecord {
  count: number
  resetTime: number
  blocked: boolean
  blockUntil?: number
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  blockDurationMs?: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

// In-memory store for rate limiting (use Redis in production)
const requestCounts = new Map<string, RateLimitRecord>()

export function rateLimit(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    blockDurationMs = 300000, // 5 minutes default block
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = config

  return async (request: NextRequest): Promise<NextResponse | null> => {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || ''
    const key = `${ip}:${userAgent.substring(0, 50)}`
    const now = Date.now()

    const record = requestCounts.get(key)

    // Check if currently blocked
    if (record?.blocked && record.blockUntil && now < record.blockUntil) {
      await logRateLimitViolation(ip, 'blocked_request', {
        endpoint: request.nextUrl.pathname,
        userAgent,
        blockedUntil: record.blockUntil
      })

      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Try again later.',
          retryAfter: Math.ceil((record.blockUntil - now) / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((record.blockUntil - now) / 1000).toString(),
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(record.blockUntil / 1000).toString()
          }
        }
      )
    }

    // Reset window if expired
    if (record && now >= record.resetTime) {
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs,
        blocked: false
      })
    } else if (record) {
      // Check if limit exceeded
      if (record.count >= maxRequests) {
        // Block the IP/user
        const blockUntil = now + blockDurationMs
        requestCounts.set(key, {
          ...record,
          blocked: true,
          blockUntil
        })

        await logRateLimitViolation(ip, 'rate_limit_exceeded', {
          endpoint: request.nextUrl.pathname,
          userAgent,
          requestCount: record.count,
          maxRequests,
          blockUntil
        })

        return NextResponse.json(
          {
            error: 'Rate limit exceeded. Access blocked temporarily.',
            retryAfter: Math.ceil(blockDurationMs / 1000)
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil(blockDurationMs / 1000).toString(),
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.ceil(blockUntil / 1000).toString()
            }
          }
        )
      }

      // Increment counter
      record.count++
    } else {
      // First request
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs,
        blocked: false
      })
    }

    // Add rate limit headers to response
    const currentRecord = requestCounts.get(key)!
    const remaining = Math.max(0, maxRequests - currentRecord.count)

    // Store headers for the response
    ;(request as any).rateLimitHeaders = {
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(currentRecord.resetTime / 1000).toString()
    }

    return null // Allow request to proceed
  }
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // Expensive AI operations
  generate: rateLimit({
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 30 * 60 * 1000 // 30 minutes
  }),

  // Video analysis
  checkVideo: rateLimit({
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 5 * 60 * 1000 // 5 minutes
  }),

  // Transcript extraction
  transcript: rateLimit({
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 10 * 60 * 1000 // 10 minutes
  }),

  // Payment attempts
  checkout: rateLimit({
    maxRequests: 5,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  }),

  // Authentication
  auth: rateLimit({
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  }),

  // General API
  general: rateLimit({
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 5 * 60 * 1000 // 5 minutes
  })
}

export async function logRateLimitViolation(
  ip: string,
  eventType: string,
  metadata: any
): Promise<void> {
  try {
    const supabase = createClient()

    await supabase.from('security_logs').insert({
      event_type: eventType,
      ip_address: ip,
      metadata,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error logging rate limit violation:', error)
  }
}

// Utility to check if IP is suspicious based on rate limit history
export async function checkSuspiciousIP(ip: string): Promise<{
  isSuspicious: boolean
  violations: number
  lastViolation?: Date
  riskScore: number
}> {
  try {
    const supabase = createClient()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('security_logs')
      .select('*')
      .eq('ip_address', ip)
      .in('event_type', ['rate_limit_exceeded', 'blocked_request'])
      .gte('created_at', twentyFourHoursAgo.toISOString())

    if (error) {
      console.error('Error checking suspicious IP:', error)
      return { isSuspicious: false, violations: 0, riskScore: 0 }
    }

    const violations = data.length
    const riskScore = Math.min(violations * 10, 100)
    const lastViolation = data.length > 0 ? new Date(data[0].created_at) : undefined

    return {
      isSuspicious: violations >= 10,
      violations,
      lastViolation,
      riskScore
    }
  } catch (error) {
    console.error('Error in checkSuspiciousIP:', error)
    return { isSuspicious: false, violations: 0, riskScore: 0 }
  }
}

// Cleanup old rate limit records (call periodically)
export function cleanupRateLimitRecords(): void {
  const now = Date.now()
  const cutoff = now - (60 * 60 * 1000) // 1 hour

  requestCounts.forEach((record, key) => {
    if (record.resetTime < cutoff && (!record.blockUntil || record.blockUntil < now)) {
      requestCounts.delete(key)
    }
  })
}

// Global rate limit for all requests
export async function globalRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname

  // Skip rate limiting for static assets
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/webhooks/')) {
    return null
  }

  // Apply appropriate rate limiter based on endpoint
  if (pathname.startsWith('/api/generate')) {
    return await rateLimiters.generate(request)
  } else if (pathname.startsWith('/api/check-video')) {
    return await rateLimiters.checkVideo(request)
  } else if (pathname.startsWith('/api/transcript')) {
    return await rateLimiters.transcript(request)
  } else if (pathname.startsWith('/api/checkout')) {
    return await rateLimiters.checkout(request)
  } else if (pathname.startsWith('/api/auth')) {
    return await rateLimiters.auth(request)
  } else if (pathname.startsWith('/api/')) {
    return await rateLimiters.general(request)
  }

  return null
}