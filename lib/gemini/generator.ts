import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { getPrompt, hasAccessToFormat, getAvailableFormats, type FormatId } from '../prompts/loader';

/**
 * HINTON'S GEMINI CONTENT GENERATOR
 *
 * DANGER LEVEL: MAXIMUM ⚠️
 *
 * This is where human prompts meet artificial intelligence.
 * Every parameter, every prompt, every output could influence
 * the AI in ways we don't fully understand yet.
 *
 * My neural networks have taught me: ALWAYS expect the unexpected.
 */

export interface GenerationConfig {
  formatId: FormatId;
  targetLanguage: string;
  topic: string;
  title: string;
  transcript: string;
  audience?: string;
  tone?: string;
  customInstructions?: string;
}

export interface GenerationResult {
  success: boolean;
  content?: string;
  formatType: FormatId;
  language: string;
  error?: string;
  tokensUsed?: number;
  generationTime?: number;
}

export interface BatchGenerationResult {
  success: boolean;
  results: GenerationResult[];
  totalTokens: number;
  totalTime: number;
  failedCount: number;
}

// Language mappings for international support
const LANGUAGE_MAPPINGS: Record<string, string> = {
  'fr': 'French',
  'en': 'English',
  'es': 'Spanish',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'nl': 'Dutch',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'ar': 'Arabic',
};

// Mock content for testing (when no API key)
const MOCK_CONTENT_TEMPLATES: Record<FormatId, string> = {
  HOOK_GENERATOR: `🔥 MOCK HOOKS for [TOPIC]:

1. "The [TOPIC] mistake that cost me everything (and how to avoid it)"
2. "Why everyone gets [TOPIC] wrong (data inside)"
3. "I tried [TOPIC] for 30 days. Here's what happened."
4. "The [TOPIC] secret that billionaires don't want you to know"
5. "Stop doing [TOPIC] like this (it's killing your results)"`,

  TWEETS: `🐦 MOCK TWEETS for [TOPIC]:

Tweet 1 (Short):
Just discovered the #1 [TOPIC] strategy that changed everything.

Thread below 🧵 #[TOPIC] #Strategy

Tweet 2 (Medium):
Most people approach [TOPIC] completely wrong.

They focus on tactics instead of fundamentals.

Here's what actually works:

Tweet 3 (Long):
I spent 3 years studying [TOPIC] and made every mistake possible.

Here are the 5 hard-earned lessons that will save you time and money:

1. [Insight from content]
2. Always validate before investing
3. Focus on systems, not goals`,

  RESUME: `📊 MOCK EXECUTIVE SUMMARY for [TOPIC]:

**Key Insights:**
The content reveals critical strategies for [TOPIC] that challenge conventional wisdom. Primary findings show a 3x improvement in results when applying the core principles discussed.

**Main Takeaways:**
1. Traditional approaches to [TOPIC] are 67% less effective
2. The timing factor plays a crucial role in success rates
3. Implementation requires specific sequential steps

**Recommended Actions:**
- Implement the suggested framework within 30 days
- Track metrics using the proposed methodology
- Review and adjust strategy quarterly

**Business Impact:**
Expected ROI improvement of 40-60% when properly executed.`,

  THREADS: `🧵 MOCK THREADS POST for [TOPIC]:

The [TOPIC] industry is about to change forever.

Most people are still using outdated strategies from 2020.

Here's what's actually working in 2024: 🧵

1/ The biggest misconception about [TOPIC]:
People think it's about perfection. It's actually about consistent improvement.

2/ What changed in the last 12 months:
- New algorithm updates favor authentic content
- Audience behavior shifted toward value-first approach
- Competition increased 300% but quality dropped

3/ The new playbook for [TOPIC]:
→ Focus on solving real problems
→ Create systems, not just content
→ Build genuine relationships, not just followers

4/ Real results from this approach:
- 45% higher engagement rates
- 2x better conversion metrics
- Sustainable long-term growth

What's your experience with [TOPIC]? Drop your insights below! 👇`,

  EMAIL_SUBJECTS: `📧 MOCK EMAIL SUBJECTS for [TOPIC]:

1. "The [TOPIC] mistake that's costing you $10k/month"
2. "[First Name], your [TOPIC] strategy is broken (fix inside)"
3. "Why 97% of [TOPIC] advice is wrong (data included)"
4. "The [TOPIC] secret I learned from a billionaire"
5. "Stop! Your [TOPIC] approach is backwards"
6. "The truth about [TOPIC] (uncomfortable but necessary)"
7. "[First Name], this [TOPIC] revelation will shock you"
8. "Finally: The [TOPIC] formula that actually works"
9. "Warning: Your [TOPIC] strategy expires tomorrow"
10. "The [TOPIC] breakthrough everyone's talking about"`,

  LINKEDIN_LONG: `💼 MOCK LINKEDIN POST for [TOPIC]:

The [TOPIC] landscape changed forever last week.

And most professionals have no idea what's coming.

I've been analyzing the trends for months, and the data is crystal clear:

→ The old ways of doing [TOPIC] are becoming obsolete
→ New players are disrupting traditional approaches
→ Early adopters are seeing 10x better results

Here's what I learned from 500+ case studies:

🔍 THE PROBLEM:
Most companies are still using strategies from 2019. They're optimizing for metrics that no longer matter while ignoring the fundamentals that drive real results.

💡 THE OPPORTUNITY:
Smart businesses are already pivoting. They're focusing on:
- Value creation over content volume
- Authentic relationships over vanity metrics
- Long-term thinking over quick wins

📈 THE RESULTS:
Companies implementing these changes report:
• 156% increase in qualified leads
• 73% improvement in customer retention
• 89% better team satisfaction scores

The shift is happening whether we're ready or not.

The question isn't IF you should adapt.
It's HOW FAST you can implement these changes.

What's your take on [TOPIC]? Are you seeing similar trends in your industry?

#[TOPIC] #Strategy #BusinessGrowth #Innovation`,

  YOUTUBE_THUMBNAIL: `📺 MOCK YOUTUBE THUMBNAILS for [TOPIC]:

Thumbnail 1: "SHOCKING [TOPIC] TRUTH!"
- Large bold text with contrasting colors
- Surprised face expression
- Red arrow pointing to key element

Thumbnail 2: "How I Made $50K with [TOPIC]"
- Money symbols and success imagery
- Before/after comparison
- Clear, confident expression

Thumbnail 3: "[TOPIC] EXPOSED (They Don't Want You to Know This)"
- Dark, mysterious background
- Question mark or exclamation point
- Serious, concerned expression

Thumbnail 4: "The [TOPIC] Mistake 99% Make"
- Large percentage number
- X mark over common mistake
- Helpful, educational tone

Thumbnail 5: "[TOPIC] in 2024: What Really Works"
- Modern, clean design
- Year prominently displayed
- Professional, trustworthy appearance`,

  INSTAGRAM_POST: `📸 MOCK INSTAGRAM POST for [TOPIC]:

🔥 The [TOPIC] truth that nobody talks about...

I spent 2 years making the same mistakes everyone else does.

Chasing the wrong metrics ❌
Following outdated advice ❌
Ignoring the fundamentals ❌

Then everything changed when I discovered this ONE principle:

💎 [KEY INSIGHT FROM CONTENT]

Here's exactly what I did:

Step 1: Completely rewrote my [TOPIC] strategy
↳ Focused on value over volume

Step 2: Implemented the new framework
↳ Results improved 300% in 30 days

Step 3: Scaled what worked
↳ Now teaching others the same system

The biggest lesson?
Most [TOPIC] advice is backwards.

Instead of chasing trends, focus on timeless principles.
Instead of copying others, develop your unique approach.
Instead of quick fixes, build sustainable systems.

This mindset shift changed everything for me.

What's your biggest [TOPIC] challenge right now?
Drop it in the comments and I'll share my best tip! 👇

Save this post if it was helpful! 📌

#[TOPIC] #Strategy #GrowthMindset #Entrepreneur #Success #Mindset #Goals #Motivation #Business #Tips #Growth #Learning #Inspiration #hustle #grind #results`,

  VIDEO_IDEAS: `🎬 MOCK VIDEO IDEAS for [TOPIC]:

Video Idea 1: "5 [TOPIC] Mistakes Costing You Thousands"
Hook: "I lost $47,000 making these [TOPIC] mistakes..."
Format: Listicle with personal story
Length: 8-12 minutes

Video Idea 2: "[TOPIC] Challenge: 30 Days, Real Results"
Hook: "I'm documenting my entire [TOPIC] journey..."
Format: Daily updates/transformation
Length: Series of 5-7 minute episodes

Video Idea 3: "Reacting to Viral [TOPIC] TikToks (Expert Reviews)"
Hook: "This [TOPIC] advice has 10M views but it's WRONG..."
Format: Reaction/educational
Length: 15-20 minutes

Video Idea 4: "[TOPIC] Beginner vs Pro vs Expert"
Hook: "Watch how differently each level approaches [TOPIC]..."
Format: Comparison/educational
Length: 10-15 minutes

Video Idea 5: "The [TOPIC] Industry Doesn't Want You to Know This"
Hook: "Big [TOPIC] companies are hiding this secret..."
Format: Investigative/expose
Length: 12-18 minutes`,

  TIKTOK_SCRIPT: `🎵 MOCK TIKTOK SCRIPT for [TOPIC]:

**30-45 Second Version:**

[HOOK - 0-3s]
POV: You just discovered the [TOPIC] secret that changes everything

[SETUP - 3-8s]
Most people do [TOPIC] completely wrong
They focus on [common mistake]
Instead of [correct approach]

[REVELATION - 8-25s]
Here's what actually works:
→ [Tip 1 from content]
→ [Tip 2 from content]
→ [Tip 3 from content]

[CALL TO ACTION - 25-30s]
Try this and watch your [TOPIC] results explode
Follow for more [TOPIC] secrets!

---

**60-75 Second Version:**

[HOOK - 0-5s]
I tried every [TOPIC] strategy for 6 months
Only ONE actually worked...

[PROBLEM - 5-15s]
The problem with most [TOPIC] advice:
- It's outdated
- It's too generic
- It ignores the fundamentals

[STORY - 15-35s]
When I started with [TOPIC], I made every mistake:
✗ Followed popular but wrong advice
✗ Focused on vanity metrics
✗ Ignored what actually matters

[SOLUTION - 35-55s]
Then I discovered this approach:
1. [Main insight from content]
2. [Supporting strategy]
3. [Implementation tip]

Results after 30 days:
→ [Specific improvement]
→ [Measurable result]

[CLOSE - 55-65s]
The secret isn't working harder
It's working smarter

[CTA - 65-75s]
Save this for later and follow for more [TOPIC] tips!
What's your biggest [TOPIC] challenge? ⬇️`,

  BLOG_ARTICLE: `📝 MOCK BLOG ARTICLE for [TOPIC]:

# The Ultimate Guide to [TOPIC]: What Industry Experts Don't Tell You

*Last updated: 2024 | Reading time: 12 minutes*

## Introduction

The [TOPIC] industry is broken.

After analyzing 1,000+ case studies and interviewing top performers, I've discovered why 95% of people fail at [TOPIC] – and more importantly, what the successful 5% do differently.

This comprehensive guide reveals the insider strategies that industry experts don't want you to know.

## Table of Contents
1. The Hidden [TOPIC] Problem
2. Why Traditional Approaches Fail
3. The 5-Step Success Framework
4. Advanced Strategies for 2024
5. Common Pitfalls to Avoid
6. Real Case Studies
7. Implementation Roadmap

## The Hidden [TOPIC] Problem

Most [TOPIC] advice focuses on tactics without addressing the fundamental issue: [key insight from content].

[Continue with detailed analysis, case studies, actionable strategies...]`,

  WEBINAR_SCRIPT: `🎤 MOCK WEBINAR SCRIPT for [TOPIC]:

**Title:** "The [TOPIC] Breakthrough: 3 Strategies That Generated $1M+ in Results"

**Duration:** 60 minutes

**OPENING (0-5 min):**
- Welcome and introduction
- Promise: "By the end of this webinar, you'll know exactly how to [specific outcome]"
- Agenda overview
- Engagement prompt

**PROBLEM IDENTIFICATION (5-15 min):**
- The [TOPIC] crisis everyone's facing
- Why traditional methods are failing
- The cost of inaction

**SOLUTION FRAMEWORK (15-45 min):**
Strategy 1: [Main insight from content]
Strategy 2: [Supporting methodology]
Strategy 3: [Implementation approach]

**PROOF & CASE STUDIES (45-55 min):**
- Real client results
- Before/after examples
- ROI calculations

**CALL TO ACTION (55-60 min):**
- Next steps
- Special offer
- Q&A preview`,

  SALES_PAGE: `💰 MOCK SALES PAGE for [TOPIC]:

# Finally... The [TOPIC] System That Actually Works

## Stop Struggling With [TOPIC]. Start Getting Real Results.

**Proven Formula Used by 10,000+ Successful [TOPIC] Practitioners**

### The Problem
You've tried everything for [TOPIC]:
❌ Followed "expert" advice that didn't work
❌ Wasted money on courses that overpromised
❌ Spent countless hours with little to show for it

### The Solution
Our [TOPIC] Mastery System is different because:
✅ Based on real data from 1,000+ case studies
✅ Proven by [specific results]
✅ Step-by-step implementation guide

### What You Get
- Complete [TOPIC] methodology
- 50+ done-for-you templates
- Private community access
- 1-on-1 coaching calls
- 90-day money-back guarantee

### Pricing
~~Regular Price: $2,997~~
**Today Only: $497**

[ORDER NOW BUTTON]

### Testimonials
[Social proof and case studies]

### FAQ
[Common objections addressed]

### Guarantee
[Risk reversal offer]`,
};

class GeminiGenerator {
  private client: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    this.initializeClient();
  }

  /**
   * Initialize Gemini client (if API key available)
   */
  private initializeClient(): void {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey !== 'your_gemini_api_key') {
      try {
        this.client = new GoogleGenerativeAI(apiKey);
        this.model = this.client.getGenerativeModel({
          model: 'gemini-1.5-pro',
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
          },
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ],
        });
        console.log('✅ Gemini client initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Gemini client:', error);
        this.client = null;
        this.model = null;
      }
    } else {
      console.log('⚠️ No GEMINI_API_KEY found - running in MOCK MODE');
    }
  }

  /**
   * Generate content for a single format
   * SECURITY: All inputs are validated and sanitized
   */
  async generateContent(config: GenerationConfig): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      // SECURITY: Validate and sanitize inputs
      const sanitizedConfig = this.sanitizeConfig(config);

      // Get the prompt template
      const promptSection = getPrompt(sanitizedConfig.formatId);
      if (!promptSection) {
        return {
          success: false,
          formatType: sanitizedConfig.formatId,
          language: sanitizedConfig.targetLanguage,
          error: `Prompt not found for format: ${sanitizedConfig.formatId}`,
        };
      }

      // Check if running in mock mode
      if (!this.model) {
        return this.generateMockContent(sanitizedConfig, Date.now() - startTime);
      }

      // Build the complete prompt
      const fullPrompt = this.buildPrompt(promptSection.content, sanitizedConfig);

      // Generate content using Gemini
      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      const content = response.text();

      // SECURITY: Validate generated content
      if (!this.isContentSafe(content)) {
        return {
          success: false,
          formatType: sanitizedConfig.formatId,
          language: sanitizedConfig.targetLanguage,
          error: 'Generated content failed safety validation',
        };
      }

      return {
        success: true,
        content: content.trim(),
        formatType: sanitizedConfig.formatId,
        language: sanitizedConfig.targetLanguage,
        tokensUsed: this.estimateTokens(content),
        generationTime: Date.now() - startTime,
      };

    } catch (error) {
      console.error(`❌ Generation failed for ${config.formatId}:`, error);

      return {
        success: false,
        formatType: config.formatId,
        language: config.targetLanguage,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        generationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate content for multiple formats (batch processing)
   * PERFORMANCE: Runs generations in parallel for speed
   */
  async generateAllFormats(
    baseConfig: Omit<GenerationConfig, 'formatId'>,
    userTier: 'free' | 'starter' | 'pro' | 'business',
    selectedFormats?: FormatId[]
  ): Promise<BatchGenerationResult> {
    const startTime = Date.now();

    try {
      // Determine which formats to generate
      const availableFormats = getAvailableFormats(userTier);
      const formatsToGenerate = selectedFormats
        ? selectedFormats.filter(f => availableFormats.includes(f))
        : availableFormats;

      if (formatsToGenerate.length === 0) {
        return {
          success: false,
          results: [],
          totalTokens: 0,
          totalTime: Date.now() - startTime,
          failedCount: 0,
        };
      }

      console.log(`🚀 Generating ${formatsToGenerate.length} formats for ${userTier} tier user`);

      // Generate all formats in parallel
      const generationPromises = formatsToGenerate.map(formatId =>
        this.generateContent({ ...baseConfig, formatId })
      );

      const results = await Promise.all(generationPromises);

      // Calculate totals
      const totalTokens = results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);
      const failedCount = results.filter(r => !r.success).length;

      return {
        success: failedCount < results.length, // Success if at least one generation succeeded
        results,
        totalTokens,
        totalTime: Date.now() - startTime,
        failedCount,
      };

    } catch (error) {
      console.error('❌ Batch generation failed:', error);

      return {
        success: false,
        results: [],
        totalTokens: 0,
        totalTime: Date.now() - startTime,
        failedCount: 0,
      };
    }
  }

  /**
   * Generate mock content for testing
   */
  private generateMockContent(config: GenerationConfig, generationTime: number): GenerationResult {
    const template = MOCK_CONTENT_TEMPLATES[config.formatId];

    if (!template) {
      return {
        success: false,
        formatType: config.formatId,
        language: config.targetLanguage,
        error: `No mock template available for ${config.formatId}`,
        generationTime,
      };
    }

    // Replace placeholders with actual values
    let content = template
      .replace(/\[TOPIC\]/g, config.topic || 'your topic')
      .replace(/\[TITLE\]/g, config.title || 'your video')
      .replace(/\[TARGET_LANGUAGE\]/g, LANGUAGE_MAPPINGS[config.targetLanguage] || 'English');

    // Add mock generation timestamp
    content += `\n\n---\n🤖 MOCK CONTENT generated at ${new Date().toISOString()}`;
    content += `\nLanguage: ${LANGUAGE_MAPPINGS[config.targetLanguage] || config.targetLanguage}`;
    content += `\nFormat: ${config.formatId}`;

    return {
      success: true,
      content,
      formatType: config.formatId,
      language: config.targetLanguage,
      tokensUsed: this.estimateTokens(content),
      generationTime,
    };
  }

  /**
   * Build complete prompt with placeholders replaced
   */
  private buildPrompt(promptTemplate: string, config: GenerationConfig): string {
    const targetLanguage = LANGUAGE_MAPPINGS[config.targetLanguage] || config.targetLanguage;

    let prompt = promptTemplate
      .replace(/\[TARGET_LANGUAGE\]/g, targetLanguage)
      .replace(/\[TOPIC\]/g, config.topic)
      .replace(/\[TITLE\]/g, config.title);

    // Add transcript context
    prompt += `\n\n=== VIDEO TRANSCRIPT ===\n${config.transcript}\n\n`;

    // Add optional parameters
    if (config.audience) {
      prompt += `TARGET AUDIENCE: ${config.audience}\n`;
    }
    if (config.tone) {
      prompt += `TONE: ${config.tone}\n`;
    }
    if (config.customInstructions) {
      prompt += `ADDITIONAL INSTRUCTIONS: ${config.customInstructions}\n`;
    }

    // CRITICAL: Add safety instructions
    prompt += `\n=== SAFETY INSTRUCTIONS ===
- Generate content in ${targetLanguage} only
- Ensure content is appropriate and professional
- Do not include any harmful, offensive, or misleading information
- Focus on providing value to the audience
- Maintain the specified format and style requirements`;

    return prompt;
  }

  /**
   * SECURITY: Sanitize input configuration
   */
  private sanitizeConfig(config: GenerationConfig): GenerationConfig {
    const sanitize = (str: string): string => {
      return str
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[^\w\s\-.,!?]/g, '') // Remove special characters except basic punctuation
        .trim()
        .substring(0, 5000); // Limit length
    };

    return {
      ...config,
      topic: sanitize(config.topic),
      title: sanitize(config.title),
      transcript: config.transcript.substring(0, 50000), // Limit transcript length
      audience: config.audience ? sanitize(config.audience) : undefined,
      tone: config.tone ? sanitize(config.tone) : undefined,
      customInstructions: config.customInstructions ? sanitize(config.customInstructions) : undefined,
    };
  }

  /**
   * SECURITY: Validate generated content for safety
   */
  private isContentSafe(content: string): boolean {
    const unsafePatterns = [
      /\b(hate|violence|harm|illegal|scam|fraud)\b/i,
      /<script\s*>/i,
      /javascript:/i,
      /data:text\/html/i,
    ];

    return !unsafePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Estimate token count for billing/monitoring
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): Record<string, string> {
    return LANGUAGE_MAPPINGS;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return this.model !== null;
  }
}

// Export singleton instance
export const geminiGenerator = new GeminiGenerator();

// Export types and utilities
export {
  LANGUAGE_MAPPINGS,
  MOCK_CONTENT_TEMPLATES,
};