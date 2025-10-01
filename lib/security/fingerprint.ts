import { createClient } from '@/lib/supabase/client'

// Client-side fingerprint generation (browser only)
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'server-side'
  }

  try {
    // Dynamic import to avoid server-side loading issues
    const FingerprintJS = await import('@fingerprintjs/fingerprintjs')
    const fp = await FingerprintJS.default.load()
    const result = await fp.get()
    return result.visitorId
  } catch (error) {
    console.error('Device fingerprint generation failed:', error)
    // Fallback to basic browser fingerprint
    return generateBasicFingerprint()
  }
}

// Basic fingerprint fallback
function generateBasicFingerprint(): string {
  if (typeof window === 'undefined') return 'server-fallback'

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx?.fillText('fingerprint', 2, 2)

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    canvas.toDataURL()
  ].join('|')

  // Simple hash function
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  return Math.abs(hash).toString(16)
}

export async function checkDuplicateFingerprints(
  fingerprint: string,
  excludeUserId?: string
): Promise<{ hasDuplicates: boolean; duplicateCount: number; duplicateUserIds: string[] }> {
  try {
    const supabase = createClient()

    let query = supabase
      .from('users')
      .select('id, email')
      .eq('device_fingerprint', fingerprint)

    if (excludeUserId) {
      query = query.not('id', 'eq', excludeUserId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error checking duplicate fingerprints:', error)
      return { hasDuplicates: false, duplicateCount: 0, duplicateUserIds: [] }
    }

    return {
      hasDuplicates: data.length > 0,
      duplicateCount: data.length,
      duplicateUserIds: data.map(user => user.id)
    }
  } catch (error) {
    console.error('Error in checkDuplicateFingerprints:', error)
    return { hasDuplicates: false, duplicateCount: 0, duplicateUserIds: [] }
  }
}

export async function flagSuspiciousDevice(
  fingerprint: string,
  reason: string,
  metadata?: any
): Promise<void> {
  try {
    const supabase = createClient()

    await supabase.from('security_logs').insert({
      event_type: 'suspicious_device',
      fingerprint,
      reason,
      metadata,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error flagging suspicious device:', error)
  }
}

// Legacy function for backwards compatibility
export async function getFingerprint(): Promise<string> {
  return getDeviceFingerprint()
}