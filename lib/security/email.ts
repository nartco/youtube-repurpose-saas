import { createClient } from '@/lib/supabase/client'

export function normalizeEmail(email: string): string {
  const [local, domain] = email.split('@')

  if (!local || !domain) {
    return email.toLowerCase()
  }

  // Gmail normalization: ignore +suffix and dots
  if (domain.toLowerCase() === 'gmail.com') {
    const cleanLocal = local.split('+')[0].replace(/\./g, '')
    return `${cleanLocal}@${domain.toLowerCase()}`
  }

  // Outlook/Hotmail normalization: ignore +suffix
  if (['outlook.com', 'hotmail.com', 'live.com'].includes(domain.toLowerCase())) {
    const cleanLocal = local.split('+')[0]
    return `${cleanLocal}@${domain.toLowerCase()}`
  }

  return email.toLowerCase()
}

export async function checkDuplicateEmail(
  email: string,
  excludeUserId?: string
): Promise<{ isDuplicate: boolean; existingUserId?: string; normalizedEmail: string }> {
  try {
    const supabase = createClient()
    const normalized = normalizeEmail(email)

    let query = supabase
      .from('users')
      .select('id, email')
      .eq('email_normalized', normalized)

    if (excludeUserId) {
      query = query.not('id', 'eq', excludeUserId)
    }

    const { data, error } = await query.single()

    // If no data found, it's not a duplicate
    if (error && error.code === 'PGRST116') {
      return { isDuplicate: false, normalizedEmail: normalized }
    }

    if (error) {
      console.error('Error checking duplicate email:', error)
      return { isDuplicate: false, normalizedEmail: normalized }
    }

    return {
      isDuplicate: !!data,
      existingUserId: data?.id,
      normalizedEmail: normalized
    }
  } catch (error) {
    console.error('Error in checkDuplicateEmail:', error)
    return { isDuplicate: false, normalizedEmail: normalizeEmail(email) }
  }
}

export function detectEmailTricks(email: string): {
  hasGmailTricks: boolean
  hasPlusSuffix: boolean
  originalEmail: string
  normalizedEmail: string
  tricks: string[]
} {
  const tricks: string[] = []
  const [local, domain] = email.split('@')
  const normalizedEmail = normalizeEmail(email)

  let hasGmailTricks = false
  let hasPlusSuffix = false

  if (domain?.toLowerCase() === 'gmail.com') {
    // Check for dots in local part
    if (local.includes('.')) {
      hasGmailTricks = true
      tricks.push('gmail_dots')
    }

    // Check for plus suffix
    if (local.includes('+')) {
      hasPlusSuffix = true
      hasGmailTricks = true
      tricks.push('gmail_plus_suffix')
    }
  } else if (['outlook.com', 'hotmail.com', 'live.com'].includes(domain?.toLowerCase() || '')) {
    // Check for plus suffix in Microsoft emails
    if (local.includes('+')) {
      hasPlusSuffix = true
      tricks.push('microsoft_plus_suffix')
    }
  }

  return {
    hasGmailTricks,
    hasPlusSuffix,
    originalEmail: email,
    normalizedEmail,
    tricks
  }
}

export async function logEmailSecurity(
  email: string,
  eventType: 'duplicate_attempt' | 'trick_detected' | 'blocked_signup',
  metadata?: any
): Promise<void> {
  try {
    const supabase = createClient()

    await supabase.from('security_logs').insert({
      event_type: eventType,
      email: email,
      email_normalized: normalizeEmail(email),
      metadata,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error logging email security event:', error)
  }
}

export function validateEmailSecurity(email: string): {
  isValid: boolean
  issues: string[]
  riskScore: number
} {
  const issues: string[] = []
  let riskScore = 0

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    issues.push('invalid_format')
    riskScore += 50
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /temp|temporary|throw|disposable|10min|guerrilla/i,
    /mailinator|maildrop|tempmail|yopmail/i,
    /test|admin|root|noreply|no-reply/i
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(email)) {
      issues.push('suspicious_pattern')
      riskScore += 30
      break
    }
  }

  // Check for email tricks
  const trickAnalysis = detectEmailTricks(email)
  if (trickAnalysis.hasGmailTricks) {
    issues.push('email_tricks_detected')
    riskScore += 20
  }

  // Check for sequential numbers (potential automation)
  if (/\d{3,}/.test(email)) {
    issues.push('sequential_numbers')
    riskScore += 10
  }

  return {
    isValid: issues.length === 0 || !issues.includes('invalid_format'),
    issues,
    riskScore: Math.min(riskScore, 100)
  }
}