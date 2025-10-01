// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  subscription_status?: 'free' | 'pro' | 'premium';
}

// Video types
export interface VideoData {
  id: string;
  url: string;
  title: string;
  transcript?: string;
  duration?: number;
  thumbnail?: string;
}

// Content generation types
export interface GenerationRequest {
  videoId: string;
  format: ContentFormat;
  customPrompt?: string;
}

export interface GenerationResult {
  id: string;
  content: string;
  format: ContentFormat;
  created_at: string;
  user_id: string;
  video_id: string;
}

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
  plan: 'free' | 'pro' | 'premium';
  status: 'active' | 'canceled' | 'past_due';
  current_period_end: string;
}