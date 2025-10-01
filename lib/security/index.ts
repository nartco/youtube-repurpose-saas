// Security fortress exports - all security functions in one place
export {
  getDeviceFingerprint,
  checkDuplicateFingerprints,
  flagSuspiciousDevice,
  getFingerprint // Legacy compatibility
} from './fingerprint'

export {
  normalizeEmail,
  checkDuplicateEmail,
  detectEmailTricks,
  logEmailSecurity,
  validateEmailSecurity
} from './email'

export {
  rateLimit,
  rateLimiters,
  logRateLimitViolation,
  checkSuspiciousIP,
  cleanupRateLimitRecords,
  globalRateLimit
} from './rate-limit'

export {
  moderateContent,
  flagUser,
  suspendUser,
  logModerationResult,
  checkUserViolations,
  type ModerationResult
} from './moderation'

export {
  sanitizeOutput,
  sanitizeMarkdown,
  sanitizeJSON,
  sanitizeBatch,
  logSanitization,
  validateSanitizedContent,
  type SanitizationResult
} from './sanitization'

// Unified security check function for complete protection
export async function performSecurityCheck(
  request: any,
  {
    checkRateLimit = true,
    moderateContent = true,
    checkFingerprint = true,
    validateEmail = true
  }: {
    checkRateLimit?: boolean
    moderateContent?: boolean
    checkFingerprint?: boolean
    validateEmail?: boolean
  } = {}
) {
  const results = {
    allowed: true,
    reasons: [] as string[],
    riskScore: 0,
    fingerprint: '',
    emailAnalysis: null as any,
    moderationResult: null as any,
    rateLimitResult: null as any
  }

  try {
    // Rate limiting check
    if (checkRateLimit && request.nextUrl) {
      const rateLimitResult = await globalRateLimit(request)
      if (rateLimitResult) {
        results.allowed = false
        results.reasons.push('rate_limit_exceeded')
        results.rateLimitResult = rateLimitResult
        return results
      }
    }

    // Device fingerprinting (if available)
    if (checkFingerprint && typeof window !== 'undefined') {
      try {
        results.fingerprint = await getDeviceFingerprint()
        const duplicateCheck = await checkDuplicateFingerprints(results.fingerprint)
        if (duplicateCheck.hasDuplicates && duplicateCheck.duplicateCount > 2) {
          results.riskScore += 30
          results.reasons.push('suspicious_device_fingerprint')
        }
      } catch (error) {
        console.warn('Fingerprint check failed:', error)
      }
    }

    // Email validation (if email provided)
    if (validateEmail && request.body?.email) {
      const emailAnalysis = validateEmailSecurity(request.body.email)
      results.emailAnalysis = emailAnalysis
      results.riskScore += emailAnalysis.riskScore

      if (!emailAnalysis.isValid) {
        results.allowed = false
        results.reasons.push('invalid_email')
      }

      if (emailAnalysis.riskScore > 50) {
        results.reasons.push('suspicious_email')
      }
    }

    // Content moderation (if content provided)
    if (moderateContent && request.body?.content) {
      const moderationResult = await moderateContent(request.body.content)
      results.moderationResult = moderationResult
      results.riskScore += moderationResult.riskScore

      if (!moderationResult.allowed) {
        results.allowed = false
        results.reasons.push('content_policy_violation')
      }
    }

    // Final risk assessment
    if (results.riskScore > 80) {
      results.allowed = false
      results.reasons.push('high_risk_score')
    }

    return results
  } catch (error) {
    console.error('Security check failed:', error)
    // Fail secure - block on error
    return {
      allowed: false,
      reasons: ['security_check_failed'],
      riskScore: 100,
      fingerprint: '',
      emailAnalysis: null,
      moderationResult: null,
      rateLimitResult: null
    }
  }
}

// Security constants for easy reference
export const SECURITY_CONSTANTS = {
  MAX_RISK_SCORE: 100,
  HIGH_RISK_THRESHOLD: 80,
  MEDIUM_RISK_THRESHOLD: 50,
  LOW_RISK_THRESHOLD: 20,

  RATE_LIMITS: {
    GENERATE: { requests: 3, window: 60 * 60 * 1000 }, // 3/hour
    TRANSCRIPT: { requests: 5, window: 60 * 1000 }, // 5/minute
    CHECKOUT: { requests: 5, window: 24 * 60 * 60 * 1000 }, // 5/day
    AUTH: { requests: 5, window: 15 * 60 * 1000 }, // 5/15min
    GENERAL: { requests: 100, window: 60 * 1000 } // 100/minute
  },

  VIOLATION_THRESHOLDS: {
    SUSPENSION: 3, // violations in 30 days
    PERMANENT_BAN: 10 // total violations
  }
} as const

// Helper function to check if user is authorized for action
export async function checkUserAuthorization(
  userId: string,
  action: 'generate' | 'transcript' | 'checkout' | 'general'
): Promise<{ authorized: boolean; reason?: string; riskLevel: string }> {
  try {
    const violations = await checkUserViolations(userId)

    if (violations.isSuspended) {
      return {
        authorized: false,
        reason: 'user_suspended',
        riskLevel: violations.riskLevel
      }
    }

    if (violations.riskLevel === 'critical') {
      return {
        authorized: false,
        reason: 'critical_risk_user',
        riskLevel: violations.riskLevel
      }
    }

    // Additional restrictions for high-risk users
    if (violations.riskLevel === 'high' && ['generate', 'transcript'].includes(action)) {
      return {
        authorized: false,
        reason: 'high_risk_action_restricted',
        riskLevel: violations.riskLevel
      }
    }

    return {
      authorized: true,
      riskLevel: violations.riskLevel
    }
  } catch (error) {
    console.error('Authorization check failed:', error)
    return {
      authorized: false,
      reason: 'authorization_check_failed',
      riskLevel: 'unknown'
    }
  }
}