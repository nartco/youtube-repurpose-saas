import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import {
  globalRateLimit,
  checkSuspiciousIP,
  checkUserViolations
} from './index'

export interface SecurityConfig {
  enableRateLimit?: boolean
  enableIPCheck?: boolean
  enableUserCheck?: boolean
  requireAuth?: boolean
  logRequests?: boolean
}

export async function securityMiddleware(
  request: NextRequest,
  config: SecurityConfig = {}
): Promise<NextResponse | null> {
  const {
    enableRateLimit = true,
    enableIPCheck = true,
    enableUserCheck = true,
    requireAuth = false,
    logRequests = true
  } = config

  const startTime = Date.now()
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const userAgent = request.headers.get('user-agent') || ''
  const pathname = request.nextUrl.pathname

  try {
    // Skip security checks for certain paths
    const skipPaths = [
      '/_next/',
      '/api/webhooks/',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml'
    ]

    if (skipPaths.some(path => pathname.startsWith(path))) {
      return null // Allow request to proceed
    }

    // Rate limiting check
    if (enableRateLimit) {
      const rateLimitResult = await globalRateLimit(request)
      if (rateLimitResult) {
        await logSecurityEvent('rate_limit_violation', {
          ip,
          userAgent,
          pathname,
          timestamp: new Date().toISOString()
        })
        return rateLimitResult
      }
    }

    // Suspicious IP check
    if (enableIPCheck) {
      const ipAnalysis = await checkSuspiciousIP(ip)
      if (ipAnalysis.isSuspicious) {
        await logSecurityEvent('suspicious_ip_blocked', {
          ip,
          violations: ipAnalysis.violations,
          riskScore: ipAnalysis.riskScore,
          pathname,
          timestamp: new Date().toISOString()
        })

        return NextResponse.json(
          { error: 'Access denied from suspicious IP address' },
          { status: 403 }
        )
      }
    }

    // User-specific security checks (if authentication is present)
    if (enableUserCheck || requireAuth) {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (requireAuth && !session?.user) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        }

        if (session?.user && enableUserCheck) {
          const userViolations = await checkUserViolations(session.user.id)

          if (userViolations.isSuspended) {
            await logSecurityEvent('suspended_user_access_attempt', {
              userId: session.user.id,
              ip,
              pathname,
              suspendedUntil: userViolations.suspendedUntil,
              timestamp: new Date().toISOString()
            })

            return NextResponse.json(
              {
                error: 'Account suspended',
                suspendedUntil: userViolations.suspendedUntil
              },
              { status: 403 }
            )
          }

          if (userViolations.riskLevel === 'critical') {
            await logSecurityEvent('critical_risk_user_access_attempt', {
              userId: session.user.id,
              ip,
              pathname,
              riskLevel: userViolations.riskLevel,
              timestamp: new Date().toISOString()
            })

            return NextResponse.json(
              { error: 'Account restricted due to security concerns' },
              { status: 403 }
            )
          }
        }
      } catch (authError) {
        console.error('Authentication check failed:', authError)
        if (requireAuth) {
          return NextResponse.json(
            { error: 'Authentication verification failed' },
            { status: 500 }
          )
        }
      }
    }

    // Log request if enabled
    if (logRequests) {
      const processingTime = Date.now() - startTime
      await logRequestEvent(request, {
        ip,
        userAgent,
        processingTime,
        securityChecks: {
          rateLimitPassed: enableRateLimit,
          ipCheckPassed: enableIPCheck,
          userCheckPassed: enableUserCheck
        }
      })
    }

    return null // Allow request to proceed

  } catch (error) {
    console.error('Security middleware error:', error)

    // Log critical error
    await logSecurityEvent('security_middleware_error', {
      ip,
      pathname,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })

    // Fail secure - block on error
    return NextResponse.json(
      { error: 'Security validation failed' },
      { status: 500 }
    )
  }
}

async function logSecurityEvent(eventType: string, metadata: any): Promise<void> {
  try {
    const supabase = createClient()

    await supabase.from('security_logs').insert({
      event_type: eventType,
      ip_address: metadata.ip,
      user_id: metadata.userId || null,
      metadata,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

async function logRequestEvent(request: NextRequest, metadata: any): Promise<void> {
  try {
    const supabase = createClient()

    await supabase.from('request_logs').insert({
      method: request.method,
      pathname: request.nextUrl.pathname,
      ip_address: metadata.ip,
      user_agent: metadata.userAgent,
      processing_time: metadata.processingTime,
      security_checks: metadata.securityChecks,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to log request event:', error)
  }
}

// Pre-configured middleware for different types of endpoints
export const middlewareConfigs = {
  // Public endpoints (landing page, docs, etc.)
  public: {
    enableRateLimit: true,
    enableIPCheck: true,
    enableUserCheck: false,
    requireAuth: false,
    logRequests: false
  },

  // API endpoints that require authentication
  authenticatedAPI: {
    enableRateLimit: true,
    enableIPCheck: true,
    enableUserCheck: true,
    requireAuth: true,
    logRequests: true
  },

  // High-security endpoints (payments, admin, etc.)
  highSecurity: {
    enableRateLimit: true,
    enableIPCheck: true,
    enableUserCheck: true,
    requireAuth: true,
    logRequests: true
  },

  // AI/ML endpoints (generation, processing)
  aiEndpoints: {
    enableRateLimit: true,
    enableIPCheck: true,
    enableUserCheck: true,
    requireAuth: true,
    logRequests: true
  },

  // Webhook endpoints
  webhooks: {
    enableRateLimit: false,
    enableIPCheck: false,
    enableUserCheck: false,
    requireAuth: false,
    logRequests: true
  }
} as const

// Helper function to apply appropriate middleware based on path
export function getSecurityConfigForPath(pathname: string): SecurityConfig {
  if (pathname.startsWith('/api/webhooks/')) {
    return middlewareConfigs.webhooks
  }

  if (pathname.startsWith('/api/generate') || pathname.startsWith('/api/transcript')) {
    return middlewareConfigs.aiEndpoints
  }

  if (pathname.startsWith('/api/checkout') || pathname.startsWith('/api/admin')) {
    return middlewareConfigs.highSecurity
  }

  if (pathname.startsWith('/api/')) {
    return middlewareConfigs.authenticatedAPI
  }

  return middlewareConfigs.public
}

// Security headers middleware
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://*.supabase.co; frame-src https://js.stripe.com;"
  )

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // Prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  )

  // HSTS (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}