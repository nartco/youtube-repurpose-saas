// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  subscription_tier: 'free' | 'starter' | 'pro' | 'business';
  credits_remaining: number;
  generations_today: number;
  last_generation_date?: string;
}

// Video types
export interface VideoData {
  id: string;
  url: string;
  title: string;
  transcript?: string;
  duration: number; // in seconds
  thumbnail?: string;
  user_id: string;
  created_at: string;
}

// Enhanced content generation types (aligned with new system)
export interface GenerationRequest {
  videoId: string;
  formats?: FormatId[]; // Multiple formats supported
  targetLanguage?: string;
  customInstructions?: string;
  audience?: string;
  tone?: string;
}

export interface GenerationResult {
  id: string;
  content: string;
  format: FormatId;
  language: string;
  tokens_used: number;
  generation_time: number;
  created_at: string;
  user_id: string;
  video_id: string;
}

// Format IDs matching our prompt system
export type FormatId =
  | 'HOOK_GENERATOR'
  | 'TWEETS'
  | 'RESUME'
  | 'THREADS'
  | 'EMAIL_SUBJECTS'
  | 'LINKEDIN_LONG'
  | 'YOUTUBE_THUMBNAIL'
  | 'INSTAGRAM_POST'
  | 'VIDEO_IDEAS'
  | 'TIKTOK_SCRIPT'
  | 'BLOG_ARTICLE'
  | 'WEBINAR_SCRIPT'
  | 'SALES_PAGE';

// Legacy support (can be removed later)
export type ContentFormat =
  | 'linkedin-post'
  | 'twitter-thread'
  | 'instagram-caption'
  | 'facebook-post'
  | 'blog-outline'
  | 'email-newsletter'
  | 'tiktok-script'
  | 'youtube-shorts';

// Security types
export interface SecurityCheck {
  isValid: boolean;
  reasons?: string[];
  fingerprint?: string;
}

// Subscription types
export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'starter' | 'pro' | 'business';
  status: 'active' | 'canceled' | 'past_due';
  current_period_end: string;
}

// AI Generation types
export interface AIGenerationResponse {
  success: boolean;
  data?: {
    videoId: string;
    generatedFormats: number;
    content: AIContentResult[];
    tokensUsed: number;
    creditsRemaining: number;
    generationsToday: number;
  };
  meta?: {
    processingTime: number;
    aiGenerationTime: number;
    failedGenerations: number;
  };
  error?: string;
  details?: any;
  upgradeRequired?: boolean;
}

export interface AIContentResult {
  success: boolean;
  content?: string;
  formatType: FormatId;
  language: string;
  error?: string;
  tokensUsed?: number;
  generationTime?: number;
}

// Usage tracking types
export interface UsageLog {
  id: string;
  user_id: string;
  video_id: string;
  action: 'content_generation' | 'transcript_extraction' | 'video_upload';
  details: {
    formats?: FormatId[];
    language?: string;
    tokensUsed?: number;
    generationTime?: number;
    successfulGenerations?: number;
    failedGenerations?: number;
  };
  created_at: string;
}

// Error logging types
export interface ErrorLog {
  id: string;
  user_id?: string;
  error_type: string;
  error_message: string;
  error_stack?: string;
  context?: any;
  created_at: string;
}

// Tier limits and validation types
export interface TierLimits {
  maxDurationMinutes: number;
  maxFileSizeMB: number;
  maxGenerationsPerDay: number;
  maxFormatsPerGeneration: number;
  name: string;
  price: string;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  currentValue: number;
  maxAllowed: number;
  userTier: string;
  suggestedUpgrade?: {
    tier: string;
    newLimit: number;
    benefits: string[];
  };
  severity: 'error' | 'warning' | 'info';
}