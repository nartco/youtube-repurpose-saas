export const CONTENT_PROMPTS = {
  'linkedin-post': `Transform this YouTube video transcript into a professional LinkedIn post.
  - Keep it engaging and professional
  - Include relevant hashtags
  - Make it 1-3 paragraphs
  - Add a clear call-to-action`,

  'twitter-thread': `Create a Twitter thread (5-7 tweets) from this YouTube video transcript.
  - Each tweet must be under 280 characters
  - Use emojis sparingly
  - Include relevant hashtags
  - Make it engaging and easy to follow`,

  'instagram-caption': `Transform this YouTube video transcript into an Instagram caption.
  - Make it engaging and visual
  - Include relevant hashtags (5-10)
  - Add emojis appropriately
  - Include a call-to-action`,

  'blog-outline': `Create a detailed blog post outline from this YouTube video transcript.
  - Include main sections and subsections
  - Add bullet points for key topics
  - Suggest compelling headlines
  - Include introduction and conclusion ideas`,

  'email-newsletter': `Transform this YouTube video transcript into an email newsletter section.
  - Create an engaging subject line
  - Write a compelling introduction
  - Break content into digestible sections
  - Include a clear call-to-action`,

  'tiktok-script': `Create a TikTok video script from this YouTube content.
  - Keep it under 60 seconds
  - Make it hook viewers in first 3 seconds
  - Include visual cue suggestions
  - Make it engaging and trendy`,
};

export const SYSTEM_INSTRUCTIONS = {
  general: `You are an expert content repurposing assistant. Your role is to transform YouTube video transcripts into engaging content for different social media platforms. Always maintain the core message and value while adapting the tone and format for the target platform.`,

  creative: `You are a creative content strategist. Focus on making content viral, engaging, and shareable while maintaining authenticity and value.`,

  professional: `You are a professional content creator. Focus on creating polished, professional content that builds authority and thought leadership.`,
};