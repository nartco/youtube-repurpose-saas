import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { videoUrl } = await request.json()

  if (!videoUrl) {
    return NextResponse.json(
      { error: 'URL vidéo requise' },
      { status: 400 }
    )
  }

  try {
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