import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { geminiGenerator, type GenerationConfig } from '@/lib/gemini/generator';
import { validateVideoDuration, validateGenerationLimits, type UserTier } from '@/lib/validation/video';
import { getAvailableFormats, hasAccessToFormat, type FormatId } from '@/lib/prompts/loader';
import {
  rateLimiters,
  moderateContent,
  checkUserViolations,
  flagUser,
  sanitizeOutput,
  type ModerationResult
} from '@/lib/security';

/**
 * HINTON'S COMPLETE AI GENERATION WORKFLOW
 *
 * ⚠️ MAXIMUM DANGER LEVEL ⚠️
 *
 * This endpoint orchestrates the entire AI content generation process:
 * 1. Authentication & Authorization
 * 2. User data & tier validation
 * 3. Video metadata & transcript retrieval
 * 4. Duration & limit validation
 * 5. AI content generation
 * 6. Database storage
 * 7. Credit management
 * 8. Usage logging
 *
 * Each step is a potential failure point. HANDLE WITH EXTREME CAUTION.
 */

interface GenerationRequestBody {
  videoId: string;
  formats?: FormatId[]; // If not provided, generate all available for user tier
  targetLanguage?: string; // Default to 'en'
  customInstructions?: string;
  audience?: string;
  tone?: string;
}

interface VideoRecord {
  id: string;
  url: string;
  title: string;
  transcript: string;
  duration: number;
  user_id: string;
  created_at: string;
}

interface UserRecord {
  id: string;
  email: string;
  subscription_tier: 'free' | 'starter' | 'pro' | 'business';
  credits_remaining: number;
  generations_today: number;
  last_generation_date: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | null = null;
  let body: GenerationRequestBody | undefined;

  try {
    console.log('🚀 Starting AI content generation workflow...');

    // SECURITY STEP 0: Apply rate limiting for expensive AI operations
    console.log('🛡️ Checking rate limits...');
    const rateLimitResult = await rateLimiters.generate(request);
    if (rateLimitResult) {
      console.log('❌ Rate limit exceeded');
      return rateLimitResult;
    }

    // STEP 1: Parse and validate request body
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ Invalid request body:', error);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (!body) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }

    const { videoId, formats, targetLanguage = 'en', customInstructions, audience, tone } = body;

    // SECURITY: Validate required fields
    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json(
        { error: 'videoId is required and must be a string' },
        { status: 400 }
      );
    }

    // STEP 2: Authenticate user
    const supabase = createServerComponentClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      console.error('❌ Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    userId = session.user.id;
    console.log(`✅ User authenticated: ${userId}`);

    // SECURITY STEP 2.5: Check user security status (violations, suspensions)
    console.log('🛡️ Checking user security status...');
    const userViolations = await checkUserViolations(userId);

    if (userViolations.isSuspended) {
      console.log('❌ User is suspended');
      return NextResponse.json(
        {
          error: 'Account suspended due to policy violations',
          suspendedUntil: userViolations.suspendedUntil,
          riskLevel: userViolations.riskLevel
        },
        { status: 403 }
      );
    }

    if (userViolations.riskLevel === 'critical') {
      console.log('❌ User has critical risk level');
      return NextResponse.json(
        {
          error: 'Account restricted due to security concerns',
          riskLevel: userViolations.riskLevel
        },
        { status: 403 }
      );
    }

    // STEP 3: Get user data and subscription info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        subscription_tier,
        credits_remaining,
        generations_today,
        last_generation_date
      `)
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('❌ Failed to fetch user data:', userError);
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      );
    }

    const user = userData as UserRecord;
    console.log(`✅ User data loaded: ${user.email} (${user.subscription_tier} tier)`);

    // STEP 4: Reset daily generation count if new day
    const today = new Date().toISOString().split('T')[0];
    const lastGenDate = user.last_generation_date?.split('T')[0];

    if (lastGenDate !== today) {
      // Reset daily counter
      await supabase
        .from('users')
        .update({
          generations_today: 0,
          last_generation_date: new Date().toISOString()
        })
        .eq('id', userId);

      user.generations_today = 0;
      console.log('📅 Daily generation count reset');
    }

    // STEP 5: Validate generation limits
    const limitValidation = validateGenerationLimits(
      user.generations_today,
      user.subscription_tier
    );

    if (!limitValidation.isValid) {
      console.error('❌ Generation limit exceeded:', limitValidation.reason);
      return NextResponse.json(
        {
          error: 'Generation limit exceeded',
          details: limitValidation,
          upgradeRequired: true
        },
        { status: 429 }
      );
    }

    // STEP 6: Check credits
    if (user.credits_remaining <= 0) {
      console.error('❌ Insufficient credits');
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          creditsRemaining: user.credits_remaining,
          upgradeRequired: true
        },
        { status: 402 }
      );
    }

    // STEP 7: Get video data and transcript
    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', userId) // SECURITY: Ensure user owns the video
      .single();

    if (videoError || !videoData) {
      console.error('❌ Video not found:', videoError);
      return NextResponse.json(
        { error: 'Video not found or access denied' },
        { status: 404 }
      );
    }

    const video = videoData as VideoRecord;
    console.log(`✅ Video loaded: ${video.title} (${video.duration}s)`);

    // STEP 8: Validate video duration
    const durationMinutes = video.duration / 60;
    const durationValidation = validateVideoDuration(durationMinutes, user.subscription_tier);

    if (!durationValidation.isValid) {
      console.error('❌ Video duration exceeds limits:', durationValidation.reason);
      return NextResponse.json(
        {
          error: 'Video duration exceeds tier limits',
          details: durationValidation,
          upgradeRequired: true
        },
        { status: 413 }
      );
    }

    // STEP 9: Check if transcript exists
    if (!video.transcript || video.transcript.trim().length === 0) {
      console.error('❌ No transcript available for video');
      return NextResponse.json(
        { error: 'No transcript available. Please extract transcript first.' },
        { status: 400 }
      );
    }

    // SECURITY STEP 9.5: Content moderation for transcript and custom instructions
    console.log('🛡️ Moderating content...');

    // Moderate transcript content
    const transcriptModeration = await moderateContent(video.transcript, 'transcript');
    if (!transcriptModeration.allowed) {
      console.log('❌ Transcript contains forbidden content');

      // Flag user for violation
      await flagUser(
        userId,
        transcriptModeration.reason || 'transcript_policy_violation',
        video.transcript,
        {
          videoId,
          patterns: transcriptModeration.patterns,
          riskScore: transcriptModeration.riskScore
        }
      );

      return NextResponse.json(
        {
          error: 'Content policy violation detected in transcript',
          reason: transcriptModeration.reason,
          riskScore: transcriptModeration.riskScore
        },
        { status: 403 }
      );
    }

    // Moderate custom instructions if provided
    if (customInstructions && customInstructions.trim().length > 0) {
      const instructionModeration = await moderateContent(customInstructions, 'user_input');
      if (!instructionModeration.allowed) {
        console.log('❌ Custom instructions contain forbidden content');

        await flagUser(
          userId,
          instructionModeration.reason || 'custom_instructions_violation',
          customInstructions,
          {
            videoId,
            patterns: instructionModeration.patterns,
            riskScore: instructionModeration.riskScore
          }
        );

        return NextResponse.json(
          {
            error: 'Content policy violation detected in custom instructions',
            reason: instructionModeration.reason,
            riskScore: instructionModeration.riskScore
          },
          { status: 403 }
        );
      }
    }

    console.log('✅ Content moderation passed');

    // Log high-risk content for review (even if allowed)
    if (transcriptModeration.flagged || (customInstructions && customInstructions.trim().length > 0)) {
      const combinedRisk = transcriptModeration.riskScore;
      if (combinedRisk > 30) {
        console.log(`⚠️ High-risk content detected (score: ${combinedRisk}) - flagged for review`);
      }
    }

    // STEP 10: Determine formats to generate
    const availableFormats = getAvailableFormats(user.subscription_tier);
    const requestedFormats = formats || availableFormats;

    // SECURITY: Validate format access
    const unauthorizedFormats = requestedFormats.filter(
      format => !hasAccessToFormat(user.subscription_tier, format)
    );

    if (unauthorizedFormats.length > 0) {
      console.error('❌ Unauthorized format access:', unauthorizedFormats);
      return NextResponse.json(
        {
          error: 'Access denied to requested formats',
          unauthorizedFormats,
          upgradeRequired: true
        },
        { status: 403 }
      );
    }

    console.log(`🎯 Generating ${requestedFormats.length} formats: ${requestedFormats.join(', ')}`);

    // STEP 11: Prepare generation configuration
    const generationConfig: Omit<GenerationConfig, 'formatId'> = {
      targetLanguage,
      topic: extractTopicFromTitle(video.title),
      title: video.title,
      transcript: video.transcript,
      audience,
      tone,
      customInstructions,
    };

    // STEP 12: Generate content with AI
    console.log('🤖 Starting AI content generation...');
    const generationResult = await geminiGenerator.generateAllFormats(
      generationConfig,
      user.subscription_tier,
      requestedFormats
    );

    if (!generationResult.success) {
      console.error('❌ AI generation failed');
      return NextResponse.json(
        {
          error: 'AI content generation failed',
          details: generationResult
        },
        { status: 500 }
      );
    }

    console.log(`✅ Generated ${generationResult.results.length} content pieces in ${generationResult.totalTime}ms`);

    // SECURITY STEP 12.5: Sanitize generated content
    console.log('🛡️ Sanitizing generated content...');
    const sanitizedResults = generationResult.results
      .filter(result => result.success)
      .map(result => {
        const sanitizationResult = sanitizeOutput(result.content || '');

        // Log sanitization if significant changes were made
        if (sanitizationResult.riskScore > 20 || sanitizationResult.modifications.length > 0) {
          console.log(`⚠️ Content sanitized for ${result.formatType}: risk score ${sanitizationResult.riskScore}, modifications: ${sanitizationResult.modifications.length}`);
        }

        return {
          ...result,
          content: sanitizationResult.sanitizedContent,
          sanitizationData: {
            originalLength: sanitizationResult.originalLength,
            sanitizedLength: sanitizationResult.sanitizedLength,
            riskScore: sanitizationResult.riskScore,
            modifications: sanitizationResult.modifications
          }
        };
      });

    console.log('✅ Content sanitization completed');

    // STEP 13: Save generated content to database
    const contentRecords = sanitizedResults.map(result => ({
      id: crypto.randomUUID(),
      user_id: userId,
      video_id: videoId,
      format: result.formatType,
      content: result.content,
      language: result.language,
      tokens_used: result.tokensUsed || 0,
      generation_time: result.generationTime || 0,
      sanitization_score: result.sanitizationData.riskScore,
      sanitization_modifications: result.sanitizationData.modifications,
      created_at: new Date().toISOString(),
    }));

    if (contentRecords.length > 0) {
      const { error: saveError } = await supabase
        .from('generated_content')
        .insert(contentRecords);

      if (saveError) {
        console.error('❌ Failed to save generated content:', saveError);
        // Don't fail the request, just log the error
      } else {
        console.log(`✅ Saved ${contentRecords.length} content records to database`);
      }
    }

    // STEP 14: Update user credits and generation count
    const newCredits = Math.max(0, user.credits_remaining - 1);
    const newGenerationCount = user.generations_today + 1;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        credits_remaining: newCredits,
        generations_today: newGenerationCount,
        last_generation_date: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to update user credits:', updateError);
      // Don't fail the request, but log for investigation
    } else {
      console.log(`✅ Updated user credits: ${user.credits_remaining} → ${newCredits}`);
    }

    // STEP 15: Log usage for analytics
    const { error: logError } = await supabase
      .from('usage_logs')
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        video_id: videoId,
        action: 'content_generation',
        details: {
          formats: requestedFormats,
          language: targetLanguage,
          tokensUsed: generationResult.totalTokens,
          generationTime: generationResult.totalTime,
          successfulGenerations: generationResult.results.filter(r => r.success).length,
          failedGenerations: generationResult.failedCount,
        },
        created_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('❌ Failed to log usage:', logError);
    }

    // STEP 16: Prepare successful response
    const totalTime = Date.now() - startTime;
    console.log(`🎉 Generation workflow completed in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      data: {
        videoId,
        generatedFormats: sanitizedResults.length,
        content: sanitizedResults.map(result => ({
          ...result,
          // Remove internal sanitization data from response
          sanitizationData: undefined
        })),
        tokensUsed: generationResult.totalTokens,
        creditsRemaining: newCredits,
        generationsToday: newGenerationCount,
      },
      meta: {
        processingTime: totalTime,
        aiGenerationTime: generationResult.totalTime,
        failedGenerations: generationResult.failedCount,
        securityChecks: {
          rateLimitPassed: true,
          contentModerationPassed: true,
          userAuthorizationPassed: true,
          outputSanitized: true
        }
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('💥 CRITICAL ERROR in generation workflow:', error);

    // Log critical error for investigation
    if (userId) {
      try {
        const supabase = createServerComponentClient({ cookies });
        await supabase
          .from('error_logs')
          .insert({
            id: crypto.randomUUID(),
            user_id: userId,
            error_type: 'generation_workflow_failure',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            error_stack: error instanceof Error ? error.stack : undefined,
            context: {
              requestBody: body || null,
              processingTime: totalTime,
            },
            created_at: new Date().toISOString(),
          });
      } catch (logError) {
        console.error('Failed to log critical error:', logError);
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error during content generation',
        requestId: crypto.randomUUID(), // For debugging
      },
      { status: 500 }
    );
  }
}

/**
 * Extract topic from video title for better prompting
 */
function extractTopicFromTitle(title: string): string {
  // Remove common video title patterns and extract core topic
  const cleaned = title
    .replace(/^\d+\.\s*/, '') // Remove numbering
    .replace(/\s*\|\s*.*$/, '') // Remove everything after |
    .replace(/\s*-\s*.*$/, '') // Remove everything after -
    .replace(/\s*\(.*\)$/, '') // Remove parentheses at end
    .replace(/\s*\[.*\]$/, '') // Remove brackets at end
    .trim();

  return cleaned || title; // Fallback to original title
}

/**
 * Health check endpoint
 */
export async function GET() {
  try {
    const isGeminiConfigured = geminiGenerator.isConfigured();

    return NextResponse.json({
      status: 'healthy',
      ai: {
        provider: 'gemini',
        configured: isGeminiConfigured,
        mode: isGeminiConfigured ? 'live' : 'mock',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}