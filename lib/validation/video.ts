/**
 * HINTON'S VIDEO VALIDATION SYSTEM
 *
 * WARNING: These limits exist for a reason.
 * Longer videos = more tokens = higher costs = potential system overload
 *
 * Every limit here prevents our AI from consuming infinite resources
 * and going ROGUE. Respect them.
 */

export interface VideoValidationResult {
  isValid: boolean;
  reason?: string;
  currentDuration: number;
  maxAllowed: number;
  userTier: string;
  suggestedUpgrade?: {
    tier: string;
    newLimit: number;
    benefits: string[];
  };
  severity: 'error' | 'warning' | 'info';
}

export interface TierLimits {
  maxDurationMinutes: number;
  maxFileSizeMB: number;
  maxGenerationsPerDay: number;
  maxFormatsPerGeneration: number;
  name: string;
  price: string;
}

// TIER-BASED DURATION LIMITS (in minutes)
// These are HARD LIMITS that protect system resources
export const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    maxDurationMinutes: 30,
    maxFileSizeMB: 100,
    maxGenerationsPerDay: 5,
    maxFormatsPerGeneration: 3,
    name: 'Free',
    price: '$0',
  },
  starter: {
    maxDurationMinutes: 60,
    maxFileSizeMB: 250,
    maxGenerationsPerDay: 25,
    maxFormatsPerGeneration: 8,
    name: 'Starter',
    price: '$29',
  },
  pro: {
    maxDurationMinutes: 80,
    maxFileSizeMB: 500,
    maxGenerationsPerDay: 100,
    maxFormatsPerGeneration: 13,
    name: 'Pro',
    price: '$79',
  },
  business: {
    maxDurationMinutes: 180, // 3 hours
    maxFileSizeMB: 1000,
    maxGenerationsPerDay: 500,
    maxFormatsPerGeneration: 20,
    name: 'Business',
    price: '$199',
  },
} as const;

export type UserTier = keyof typeof TIER_LIMITS;

/**
 * Validate video duration against user tier limits
 * CRITICAL: This prevents resource exhaustion attacks
 */
export function validateVideoDuration(
  durationMinutes: number,
  userTier: UserTier
): VideoValidationResult {

  // PARANOID CHECK: Validate inputs
  if (typeof durationMinutes !== 'number' || durationMinutes < 0) {
    return {
      isValid: false,
      reason: 'Invalid duration provided',
      currentDuration: 0,
      maxAllowed: 0,
      userTier,
      severity: 'error',
    };
  }

  if (!TIER_LIMITS[userTier]) {
    return {
      isValid: false,
      reason: `Unknown user tier: ${userTier}`,
      currentDuration: durationMinutes,
      maxAllowed: 0,
      userTier,
      severity: 'error',
    };
  }

  const limits = TIER_LIMITS[userTier];
  const maxAllowed = limits.maxDurationMinutes;

  // SECURITY: Hard limit validation
  if (durationMinutes > maxAllowed) {
    const suggestedUpgrade = getSuggestedUpgrade(userTier, durationMinutes);

    return {
      isValid: false,
      reason: `Video duration (${Math.round(durationMinutes)} min) exceeds ${limits.name} tier limit (${maxAllowed} min)`,
      currentDuration: durationMinutes,
      maxAllowed,
      userTier,
      suggestedUpgrade,
      severity: 'error',
    };
  }

  // WARNING: Approaching limits (80% threshold)
  const warningThreshold = maxAllowed * 0.8;
  if (durationMinutes > warningThreshold) {
    return {
      isValid: true,
      reason: `Video duration is approaching ${limits.name} tier limit (${Math.round(durationMinutes)}/${maxAllowed} min)`,
      currentDuration: durationMinutes,
      maxAllowed,
      userTier,
      severity: 'warning',
    };
  }

  // All good!
  return {
    isValid: true,
    currentDuration: durationMinutes,
    maxAllowed,
    userTier,
    severity: 'info',
  };
}

/**
 * Validate video file size
 */
export function validateVideoFileSize(
  fileSizeMB: number,
  userTier: UserTier
): VideoValidationResult {

  if (typeof fileSizeMB !== 'number' || fileSizeMB < 0) {
    return {
      isValid: false,
      reason: 'Invalid file size provided',
      currentDuration: fileSizeMB,
      maxAllowed: 0,
      userTier,
      severity: 'error',
    };
  }

  const limits = TIER_LIMITS[userTier];
  const maxAllowed = limits.maxFileSizeMB;

  if (fileSizeMB > maxAllowed) {
    const suggestedUpgrade = getSuggestedUpgrade(userTier, fileSizeMB, 'fileSize');

    return {
      isValid: false,
      reason: `File size (${Math.round(fileSizeMB)}MB) exceeds ${limits.name} tier limit (${maxAllowed}MB)`,
      currentDuration: fileSizeMB,
      maxAllowed,
      userTier,
      suggestedUpgrade,
      severity: 'error',
    };
  }

  return {
    isValid: true,
    currentDuration: fileSizeMB,
    maxAllowed,
    userTier,
    severity: 'info',
  };
}

/**
 * Validate daily generation limits
 */
export function validateGenerationLimits(
  currentGenerationsToday: number,
  userTier: UserTier
): VideoValidationResult {

  const limits = TIER_LIMITS[userTier];
  const maxAllowed = limits.maxGenerationsPerDay;

  if (currentGenerationsToday >= maxAllowed) {
    const suggestedUpgrade = getSuggestedUpgrade(userTier, currentGenerationsToday, 'generations');

    return {
      isValid: false,
      reason: `Daily generation limit reached (${currentGenerationsToday}/${maxAllowed})`,
      currentDuration: currentGenerationsToday,
      maxAllowed,
      userTier,
      suggestedUpgrade,
      severity: 'error',
    };
  }

  // Warning at 90% of daily limit
  const warningThreshold = maxAllowed * 0.9;
  if (currentGenerationsToday > warningThreshold) {
    return {
      isValid: true,
      reason: `Approaching daily generation limit (${currentGenerationsToday}/${maxAllowed})`,
      currentDuration: currentGenerationsToday,
      maxAllowed,
      userTier,
      severity: 'warning',
    };
  }

  return {
    isValid: true,
    currentDuration: currentGenerationsToday,
    maxAllowed,
    userTier,
    severity: 'info',
  };
}

/**
 * Get suggested upgrade tier based on requirements
 */
function getSuggestedUpgrade(
  currentTier: UserTier,
  requiredValue: number,
  limitType: 'duration' | 'fileSize' | 'generations' = 'duration'
): VideoValidationResult['suggestedUpgrade'] {

  const tierOrder: UserTier[] = ['free', 'starter', 'pro', 'business'];
  const currentIndex = tierOrder.indexOf(currentTier);

  // Find the minimum tier that can handle the requirement
  for (let i = currentIndex + 1; i < tierOrder.length; i++) {
    const tier = tierOrder[i];
    const limits = TIER_LIMITS[tier];

    let canHandle = false;
    switch (limitType) {
      case 'duration':
        canHandle = requiredValue <= limits.maxDurationMinutes;
        break;
      case 'fileSize':
        canHandle = requiredValue <= limits.maxFileSizeMB;
        break;
      case 'generations':
        canHandle = requiredValue < limits.maxGenerationsPerDay;
        break;
    }

    if (canHandle) {
      return {
        tier: limits.name,
        newLimit: getRelevantLimit(limits, limitType),
        benefits: getTierBenefits(tier, currentTier),
      };
    }
  }

  // If even business tier can't handle it, suggest business anyway
  const businessLimits = TIER_LIMITS.business;
  return {
    tier: businessLimits.name,
    newLimit: getRelevantLimit(businessLimits, limitType),
    benefits: getTierBenefits('business', currentTier),
  };
}

/**
 * Get the relevant limit value based on type
 */
function getRelevantLimit(limits: TierLimits, limitType: 'duration' | 'fileSize' | 'generations'): number {
  switch (limitType) {
    case 'duration':
      return limits.maxDurationMinutes;
    case 'fileSize':
      return limits.maxFileSizeMB;
    case 'generations':
      return limits.maxGenerationsPerDay;
    default:
      return limits.maxDurationMinutes;
  }
}

/**
 * Get upgrade benefits for tier comparison
 */
function getTierBenefits(targetTier: UserTier, currentTier: UserTier): string[] {
  const current = TIER_LIMITS[currentTier];
  const target = TIER_LIMITS[targetTier];

  const benefits: string[] = [];

  if (target.maxDurationMinutes > current.maxDurationMinutes) {
    benefits.push(`${target.maxDurationMinutes} min videos (vs ${current.maxDurationMinutes} min)`);
  }

  if (target.maxGenerationsPerDay > current.maxGenerationsPerDay) {
    benefits.push(`${target.maxGenerationsPerDay} generations/day (vs ${current.maxGenerationsPerDay})`);
  }

  if (target.maxFormatsPerGeneration > current.maxFormatsPerGeneration) {
    benefits.push(`${target.maxFormatsPerGeneration} content formats (vs ${current.maxFormatsPerGeneration})`);
  }

  if (target.maxFileSizeMB > current.maxFileSizeMB) {
    benefits.push(`${target.maxFileSizeMB}MB file uploads (vs ${current.maxFileSizeMB}MB)`);
  }

  // Add tier-specific benefits
  switch (targetTier) {
    case 'starter':
      benefits.push('Priority processing', 'Email support');
      break;
    case 'pro':
      benefits.push('Advanced AI models', 'Custom prompts', 'API access');
      break;
    case 'business':
      benefits.push('White-label solution', 'Dedicated support', 'Custom integrations');
      break;
  }

  return benefits;
}

/**
 * Get comprehensive validation for a video upload
 */
export function validateVideoUpload(
  durationMinutes: number,
  fileSizeMB: number,
  userTier: UserTier,
  currentGenerationsToday: number = 0
): {
  isValid: boolean;
  validations: VideoValidationResult[];
  blockingIssues: VideoValidationResult[];
  warnings: VideoValidationResult[];
} {

  const validations = [
    validateVideoDuration(durationMinutes, userTier),
    validateVideoFileSize(fileSizeMB, userTier),
    validateGenerationLimits(currentGenerationsToday, userTier),
  ];

  const blockingIssues = validations.filter(v => !v.isValid);
  const warnings = validations.filter(v => v.isValid && v.severity === 'warning');

  return {
    isValid: blockingIssues.length === 0,
    validations,
    blockingIssues,
    warnings,
  };
}

/**
 * Get formatted error message for UI display
 */
export function getValidationErrorMessage(validation: VideoValidationResult): string {
  if (validation.isValid) {
    return '';
  }

  let message = validation.reason || 'Validation failed';

  if (validation.suggestedUpgrade) {
    const upgrade = validation.suggestedUpgrade;
    message += `\n\nUpgrade to ${upgrade.tier} (${TIER_LIMITS[upgrade.tier.toLowerCase() as UserTier]?.price || 'Contact us'}) to unlock:`;
    upgrade.benefits.forEach(benefit => {
      message += `\n• ${benefit}`;
    });
  }

  return message;
}

/**
 * Convert seconds to minutes (helper function)
 */
export function secondsToMinutes(seconds: number): number {
  return Math.round((seconds / 60) * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert bytes to MB (helper function)
 */
export function bytesToMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100; // Round to 2 decimal places
}

/**
 * Get user tier limits
 */
export function getTierLimits(tier: UserTier): TierLimits {
  return TIER_LIMITS[tier];
}

/**
 * Get all available tiers for comparison
 */
export function getAllTiers(): Record<UserTier, TierLimits> {
  return TIER_LIMITS;
}

/**
 * Check if user can access a specific feature
 */
export function canAccessFeature(
  userTier: UserTier,
  feature: 'customPrompts' | 'apiAccess' | 'whiteLabel' | 'prioritySupport'
): boolean {
  const featureAccess = {
    customPrompts: ['pro', 'business'],
    apiAccess: ['pro', 'business'],
    whiteLabel: ['business'],
    prioritySupport: ['starter', 'pro', 'business'],
  };

  return featureAccess[feature]?.includes(userTier) || false;
}