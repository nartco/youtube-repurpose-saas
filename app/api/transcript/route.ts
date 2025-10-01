import { NextRequest, NextResponse } from 'next/server'
import { rateLimiters } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting for transcript extraction
    const rateLimitResult = await rateLimiters.transcript(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    const { videoUrl } = await request.json()

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'URL vidéo requise' },
        { status: 400 }
      )
    }

    // SECURITY: Basic URL validation
    try {
      const url = new URL(videoUrl);
      const allowedDomains = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];
      if (!allowedDomains.includes(url.hostname)) {
        return NextResponse.json(
          { error: 'URL non autorisée. Seules les URLs YouTube sont acceptées.' },
          { status: 400 }
        );
      }
    } catch (urlError) {
      return NextResponse.json(
        { error: 'URL invalide' },
        { status: 400 }
      );
    }

    // Call Python service
    const response = await fetch(
      `${process.env.PYTHON_SERVICE_URL}/api/transcript`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: 400 })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}