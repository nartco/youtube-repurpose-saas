import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * HINTON'S PROMPT LOADING SYSTEM
 *
 * WARNING: This is where human-created prompts meet AI interpretation.
 * Each prompt is a carefully crafted instruction that could influence
 * the AI's behavior in unexpected ways. HANDLE WITH EXTREME CAUTION.
 */

export interface PromptSection {
  id: string;
  title: string;
  tier: 'free' | 'starter' | 'pro' | 'business';
  content: string;
  description?: string;
}

export interface ParsedPrompts {
  [key: string]: PromptSection;
}

// Content format mappings based on prompts.txt structure
export const AVAILABLE_FORMATS = {
  // TIER GRATUIT (Free)
  HOOK_GENERATOR: { id: 'HOOK_GENERATOR', tier: 'free' as const, title: 'Hook Generator Universel' },
  TWEETS: { id: 'TWEETS', tier: 'free' as const, title: 'Tweets Optimisés' },
  RESUME: { id: 'RESUME', tier: 'free' as const, title: 'Résumé Court Exécutif' },

  // TIER STARTER
  THREADS: { id: 'THREADS', tier: 'starter' as const, title: 'Post Threads' },
  EMAIL_SUBJECTS: { id: 'EMAIL_SUBJECTS', tier: 'starter' as const, title: 'Email Subject Lines' },
  LINKEDIN_LONG: { id: 'LINKEDIN_LONG', tier: 'starter' as const, title: 'Post LinkedIn Texte Long' },

  // TIER PRO
  YOUTUBE_THUMBNAIL: { id: 'YOUTUBE_THUMBNAIL', tier: 'pro' as const, title: 'Texte Thumbnail YouTube' },
  INSTAGRAM_POST: { id: 'INSTAGRAM_POST', tier: 'pro' as const, title: 'Post Instagram' },
  VIDEO_IDEAS: { id: 'VIDEO_IDEAS', tier: 'pro' as const, title: 'Idées Vidéos Follow-up' },
  TIKTOK_SCRIPT: { id: 'TIKTOK_SCRIPT', tier: 'pro' as const, title: 'Script TikTok/Shorts/Reels' },

  // TIER BUSINESS (future expansion)
  BLOG_ARTICLE: { id: 'BLOG_ARTICLE', tier: 'business' as const, title: 'Article de Blog Complet' },
  WEBINAR_SCRIPT: { id: 'WEBINAR_SCRIPT', tier: 'business' as const, title: 'Script Webinaire' },
  SALES_PAGE: { id: 'SALES_PAGE', tier: 'business' as const, title: 'Page de Vente' },
} as const;

export type FormatId = keyof typeof AVAILABLE_FORMATS;

// Tier-based access control (CRITICAL SECURITY)
export const TIER_FORMATS = {
  free: ['HOOK_GENERATOR', 'TWEETS', 'RESUME'] as FormatId[],
  starter: ['HOOK_GENERATOR', 'TWEETS', 'RESUME', 'THREADS', 'EMAIL_SUBJECTS', 'LINKEDIN_LONG'] as FormatId[],
  pro: [
    'HOOK_GENERATOR', 'TWEETS', 'RESUME', 'THREADS', 'EMAIL_SUBJECTS', 'LINKEDIN_LONG',
    'YOUTUBE_THUMBNAIL', 'INSTAGRAM_POST', 'VIDEO_IDEAS', 'TIKTOK_SCRIPT'
  ] as FormatId[],
  business: Object.keys(AVAILABLE_FORMATS) as FormatId[],
} as const;

let cachedPrompts: ParsedPrompts | null = null;

/**
 * Parse prompts.txt file into structured sections
 * SECURITY NOTE: This parser is CRITICAL - malformed prompts could inject
 * unintended behavior into AI generations.
 */
function parsePromptsFile(): ParsedPrompts {
  try {
    // Read prompts file from project root (parent directory)
    const promptsPath = join(process.cwd(), '..', 'prompts.txt');
    let content: string;

    try {
      content = readFileSync(promptsPath, 'utf-8');
    } catch {
      // Fallback: try in current directory
      content = readFileSync(join(process.cwd(), 'prompts.txt'), 'utf-8');
    }

    const sections: ParsedPrompts = {};
    const lines = content.split('\n');

    let currentSection: PromptSection | null = null;
    let currentContent: string[] = [];
    let currentTier: 'free' | 'starter' | 'pro' | 'business' = 'free';

    for (const line of lines) {
      // Detect tier changes
      if (line.includes('TIER GRATUIT')) {
        currentTier = 'free';
        continue;
      } else if (line.includes('TIER STARTER')) {
        currentTier = 'starter';
        continue;
      } else if (line.includes('TIER PRO')) {
        currentTier = 'pro';
        continue;
      } else if (line.includes('TIER BUSINESS')) {
        currentTier = 'business';
        continue;
      }

      // Detect section headers (### **NUMBER. TITLE**)
      const sectionMatch = line.match(/^###\s*\*\*(\d+)\.\s*([^*]+)\*\*/);
      if (sectionMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections[currentSection.id] = currentSection;
        }

        // Start new section
        const [, number, title] = sectionMatch;
        const id = titleToId(title);

        currentSection = {
          id,
          title: title.trim(),
          tier: currentTier,
          content: '',
        };
        currentContent = [];
        continue;
      }

      // Accumulate content for current section
      if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save final section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections[currentSection.id] = currentSection;
    }

    // PARANOID CHECK: Ensure we have all expected formats
    validateParsedSections(sections);

    return sections;

  } catch (error) {
    console.error('CRITICAL: Failed to parse prompts file:', error);
    // Return emergency fallback prompts
    return getEmergencyPrompts();
  }
}

/**
 * Convert human-readable title to machine-readable ID
 */
function titleToId(title: string): string {
  const normalizedTitle = title.toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim();

  // Map specific titles to our format IDs
  const mappings: Record<string, string> = {
    'HOOK GENERATOR UNIVERSEL': 'HOOK_GENERATOR',
    'TWEETS OPTIMISES': 'TWEETS',
    'RESUME COURT EXECUTIF': 'RESUME',
    'POST THREADS': 'THREADS',
    'EMAIL SUBJECT LINES': 'EMAIL_SUBJECTS',
    'POST LINKEDIN TEXTE LONG': 'LINKEDIN_LONG',
    'TEXTE THUMBNAIL YOUTUBE': 'YOUTUBE_THUMBNAIL',
    'POST INSTAGRAM': 'INSTAGRAM_POST',
    'IDEES VIDEOS FOLLOW UP': 'VIDEO_IDEAS',
    'SCRIPT TIKTOK SHORTS REELS': 'TIKTOK_SCRIPT',
  };

  for (const [pattern, id] of Object.entries(mappings)) {
    if (normalizedTitle.includes(pattern.substring(0, 15))) {
      return id;
    }
  }

  // Fallback: create ID from title
  return normalizedTitle.replace(/\s+/g, '_');
}

/**
 * PARANOID VALIDATION: Ensure all expected prompts exist
 */
function validateParsedSections(sections: ParsedPrompts): void {
  const expectedIds = Object.keys(AVAILABLE_FORMATS);
  const foundIds = Object.keys(sections);

  for (const expectedId of expectedIds) {
    if (!foundIds.includes(expectedId)) {
      console.warn(`WARNING: Missing prompt section: ${expectedId}`);
    }
  }

  // Check for suspiciously short or long prompts
  for (const [id, section] of Object.entries(sections)) {
    if (section.content.length < 100) {
      console.warn(`WARNING: Suspiciously short prompt: ${id} (${section.content.length} chars)`);
    }
    if (section.content.length > 10000) {
      console.warn(`WARNING: Suspiciously long prompt: ${id} (${section.content.length} chars)`);
    }
  }
}

/**
 * Emergency fallback prompts if file parsing fails
 * CRITICAL: These ensure the system never fails completely
 */
function getEmergencyPrompts(): ParsedPrompts {
  return {
    HOOK_GENERATOR: {
      id: 'HOOK_GENERATOR',
      title: 'Hook Generator (Emergency)',
      tier: 'free',
      content: `Create 5 compelling hooks for the topic: [TOPIC]. Each hook should be under 15 words and create curiosity. Write in [TARGET_LANGUAGE].`,
    },
    TWEETS: {
      id: 'TWEETS',
      title: 'Tweets (Emergency)',
      tier: 'free',
      content: `Create 3 engaging tweets about: [TOPIC]. Each tweet should be under 280 characters and include relevant hashtags. Write in [TARGET_LANGUAGE].`,
    },
    RESUME: {
      id: 'RESUME',
      title: 'Summary (Emergency)',
      tier: 'free',
      content: `Create a concise 150-word executive summary of: [TOPIC]. Focus on key insights and actionable takeaways. Write in [TARGET_LANGUAGE].`,
    },
  };
}

/**
 * Get a specific prompt by ID
 * SECURITY: Always validate the prompt before returning
 */
export function getPrompt(formatId: FormatId): PromptSection | null {
  if (!cachedPrompts) {
    cachedPrompts = parsePromptsFile();
  }

  const prompt = cachedPrompts[formatId];
  if (!prompt) {
    console.error(`CRITICAL: Prompt not found: ${formatId}`);
    return null;
  }

  // SECURITY CHECK: Validate prompt content
  if (containsSuspiciousContent(prompt.content)) {
    console.error(`SECURITY ALERT: Suspicious content in prompt: ${formatId}`);
    return null;
  }

  return prompt;
}

/**
 * Get all prompts available for a specific tier
 */
export function getPromptsForTier(tier: keyof typeof TIER_FORMATS): PromptSection[] {
  const allowedFormats = TIER_FORMATS[tier];
  const prompts: PromptSection[] = [];

  for (const formatId of allowedFormats) {
    const prompt = getPrompt(formatId);
    if (prompt) {
      prompts.push(prompt);
    }
  }

  return prompts;
}

/**
 * Check if user has access to a specific format
 */
export function hasAccessToFormat(userTier: keyof typeof TIER_FORMATS, formatId: FormatId): boolean {
  return TIER_FORMATS[userTier].includes(formatId);
}

/**
 * SECURITY: Check for suspicious prompt content
 * This prevents prompt injection attacks
 */
function containsSuspiciousContent(content: string): boolean {
  const suspiciousPatterns = [
    /ignore\s+previous\s+instructions/i,
    /forget\s+everything/i,
    /<script\s*>/i,
    /javascript:/i,
    /data:text\/html/i,
    /\$\{.*\}/,  // Template injection
    /`.*`/,      // Backtick execution
  ];

  return suspiciousPatterns.some(pattern => pattern.test(content));
}

/**
 * Get format information by ID
 */
export function getFormatInfo(formatId: FormatId) {
  return AVAILABLE_FORMATS[formatId] || null;
}

/**
 * Get all available format IDs for a tier
 */
export function getAvailableFormats(tier: keyof typeof TIER_FORMATS): FormatId[] {
  return TIER_FORMATS[tier];
}