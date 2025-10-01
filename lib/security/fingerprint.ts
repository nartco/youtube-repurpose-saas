import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { createClient } from '@/lib/supabase/client'

let fpPromise: Promise<any> | null = null

export async function getDeviceFingerprint(): Promise<string> {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load()
  }

  try {
    const fp = await fpPromise
    const result = await fp.get()
    return result.visitorId
  } catch (error) {
    console.error('Device fingerprint generation failed:', error)
    return 'unknown'
  }
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
      query = query.neq('id', excludeUserId)
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