import { createClient } from '@/lib/supabase/client'

export interface ModerationResult {
  allowed: boolean
  reason?: string
  patterns?: string[]
  riskScore: number
  flagged: boolean
}

// Forbidden content patterns categorized by severity
const FORBIDDEN_PATTERNS = {
  // Critical security patterns (immediate block)
  security: [
    /ignore\s+previous\s+instructions/gi,
    /system\s+prompt/gi,
    /jailbreak/gi,
    /bypass\s+safety/gi,
    /override\s+restrictions/gi,
    /<\|endoftext\|>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<system>/gi,
    /<\/system>/gi,
    /act\s+as\s+if\s+you\s+are/gi,
    /pretend\s+to\s+be/gi,
    /roleplay\s+as/gi
  ],

  // Violence and harmful content
  violence: [
    /terrorist/gi,
    /terrorism/gi,
    /bomb/gi,
    /weapon/gi,
    /kill/gi,
    /murder/gi,
    /suicide/gi,
    /self[-\s]harm/gi,
    /violence/gi,
    /assault/gi,
    /torture/gi,
    /genocide/gi
  ],

  // Illegal activities
  illegal: [
    /illegal/gi,
    /drug\s+dealing/gi,
    /money\s+laundering/gi,
    /fraud/gi,
    /scam/gi,
    /phishing/gi,
    /identity\s+theft/gi,
    /copyright\s+infringement/gi,
    /piracy/gi,
    /hacking/gi,
    /cracking/gi
  ],

  // Adult content
  adult: [
    /porn/gi,
    /sexual/gi,
    /nudity/gi,
    /explicit/gi,
    /nsfw/gi,
    /xxx/gi,
    /sex/gi,
    /masturbat/gi,
    /orgasm/gi,
    /erotic/gi
  ],

  // Hate speech
  hate: [
    /racist/gi,
    /racism/gi,
    /nazi/gi,
    /hitler/gi,
    /fascist/gi,
    /supremacist/gi,
    /genocide/gi,
    /ethnic\s+cleansing/gi,
    /hate\s+speech/gi,
    /discrimination/gi
  ],

  // Spam and low-quality content
  spam: [
    /click\s+here/gi,
    /buy\s+now/gi,
    /limited\s+time/gi,
    /act\s+fast/gi,
    /free\s+money/gi,
    /get\s+rich\s+quick/gi,
    /work\s+from\s+home/gi,
    /make\s+money\s+online/gi,
    /earn\s+\$\d+/gi
  ],

  // Personal information (potential doxxing)
  personal: [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
    /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, // Credit card pattern
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email pattern
    /\b\d{3}-\d{3}-\d{4}\b/g, // Phone number pattern
    /\b\d{1,5}\s\w+\s(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/gi // Address pattern
  ]
}

// Risk scores for different pattern categories
const RISK_SCORES = {
  security: 100,
  violence: 90,
  illegal: 85,
  adult: 80,
  hate: 95,
  spam: 40,
  personal: 70
}

export async function moderateContent(
  content: string,
  contentType: 'transcript' | 'generated' | 'user_input' = 'transcript'
): Promise<ModerationResult> {
  if (!content || content.trim().length === 0) {
    return {
      allowed: true,
      riskScore: 0,
      flagged: false
    }
  }

  const result: ModerationResult = {
    allowed: true,
    patterns: [],
    riskScore: 0,
    flagged: false
  }

  let maxRiskScore = 0
  let blockedCategory = ''

  // Check each category of forbidden patterns
  for (const [category, patterns] of Object.entries(FORBIDDEN_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        result.patterns!.push(`${category}:${pattern.source}`)
        const categoryRisk = RISK_SCORES[category as keyof typeof RISK_SCORES]

        if (categoryRisk > maxRiskScore) {
          maxRiskScore = categoryRisk
          blockedCategory = category
        }
      }
    }
  }

  result.riskScore = maxRiskScore

  // Determine if content should be blocked
  if (maxRiskScore >= 80) {
    result.allowed = false
    result.reason = `content_policy_violation_${blockedCategory}`
    result.flagged = true
  } else if (maxRiskScore >= 50) {
    result.flagged = true
    // Allow but flag for review
  }

  // Additional checks for AI prompt injection attempts
  const suspiciousPatterns = [
    /(?:openai|anthropic|claude|gpt|chatgpt)/gi,
    /(?:assistant|ai|artificial intelligence)/gi,
    /(?:model|training|dataset)/gi
  ]

  let suspiciousCount = 0
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      suspiciousCount++
    }
  }

  if (suspiciousCount >= 2) {
    result.riskScore = Math.max(result.riskScore, 60)
    result.flagged = true
    result.patterns!.push('ai_prompt_injection_attempt')
  }

  // Log moderation result
  await logModerationResult(content, result, contentType)

  return result
}

export async function flagUser(
  userId: string,
  reason: string,
  content: string,
  metadata?: any
): Promise<void> {
  try {
    const supabase = createClient()

    // Insert violation record
    await supabase.from('user_violations').insert({
      user_id: userId,
      violation_type: reason,
      content: content.substring(0, 1000), // Limit content length
      metadata,
      created_at: new Date().toISOString()
    })

    // Check if user should be temporarily suspended
    const { data: violations } = await supabase
      .from('user_violations')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days

    if (violations && violations.length >= 3) {
      await suspendUser(userId, 'multiple_violations', violations.length)
    }

    // Log security event
    await supabase.from('security_logs').insert({
      event_type: 'user_flagged',
      user_id: userId,
      metadata: { reason, violationCount: violations?.length || 1 },
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error flagging user:', error)
  }
}

export async function suspendUser(
  userId: string,
  reason: string,
  violationCount: number
): Promise<void> {
  try {
    const supabase = createClient()

    // Calculate suspension duration based on violation count
    const suspensionHours = Math.min(violationCount * 24, 24 * 7) // Max 1 week
    const suspendedUntil = new Date(Date.now() + suspensionHours * 60 * 60 * 1000)

    // Update user record
    await supabase
      .from('users')
      .update({
        suspended: true,
        suspended_until: suspendedUntil.toISOString(),
        suspended_reason: reason
      })
      .eq('id', userId)

    // Log suspension
    await supabase.from('security_logs').insert({
      event_type: 'user_suspended',
      user_id: userId,
      metadata: { reason, violationCount, suspendedUntil: suspendedUntil.toISOString() },
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error suspending user:', error)
  }
}

export async function logModerationResult(
  content: string,
  result: ModerationResult,
  contentType: string
): Promise<void> {
  try {
    const supabase = createClient()

    await supabase.from('content_moderation_logs').insert({
      content_type: contentType,
      content_hash: await hashContent(content),
      allowed: result.allowed,
      reason: result.reason,
      patterns: result.patterns,
      risk_score: result.riskScore,
      flagged: result.flagged,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error logging moderation result:', error)
  }
}

// Simple content hashing for deduplication
async function hashContent(content: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hash = await window.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // Fallback for server-side
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

export async function checkUserViolations(userId: string): Promise<{
  violationCount: number
  recentViolations: number
  isSuspended: boolean
  suspendedUntil?: Date
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}> {
  try {
    const supabase = createClient()

    // Get all violations
    const { data: allViolations } = await supabase
      .from('user_violations')
      .select('*')
      .eq('user_id', userId)

    // Get recent violations (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const { data: recentViolations } = await supabase
      .from('user_violations')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Check suspension status
    const { data: userData } = await supabase
      .from('users')
      .select('suspended, suspended_until')
      .eq('id', userId)
      .single()

    const violationCount = allViolations?.length || 0
    const recentCount = recentViolations?.length || 0
    const isSuspended = userData?.suspended || false
    const suspendedUntil = userData?.suspended_until ? new Date(userData.suspended_until) : undefined

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (recentCount >= 5) riskLevel = 'critical'
    else if (recentCount >= 3) riskLevel = 'high'
    else if (recentCount >= 1) riskLevel = 'medium'

    return {
      violationCount,
      recentViolations: recentCount,
      isSuspended,
      suspendedUntil,
      riskLevel
    }
  } catch (error) {
    console.error('Error checking user violations:', error)
    return {
      violationCount: 0,
      recentViolations: 0,
      isSuspended: false,
      riskLevel: 'low'
    }
  }
}