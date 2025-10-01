import FingerprintJS from '@fingerprintjs/fingerprintjs';

export async function getFingerprint(): Promise<string> {
  try {
    // Initialize the agent at application startup.
    const fp = await FingerprintJS.load();

    // Get the visitor identifier when you need it.
    const result = await fp.get();

    return result.visitorId;
  } catch (error) {
    console.error('Fingerprint generation failed:', error);
    return 'unknown';
  }
}