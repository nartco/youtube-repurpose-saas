'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useUser } from '@/lib/hooks/useUser'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const { user } = useUser()
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [metadata, setMetadata] = useState<any>(null)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    setLoading(true)
    setError('')
    setMetadata(null)

    try {
      const res = await fetch('/api/check-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: url }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur')
        return
      }

      setMetadata(data)
    } catch (err) {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setLoading(true)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: url }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur')
        return
      }

      // Redirect to results
      router.push(`/results/${data.video.id}`)
    } catch (err) {
      setError('Erreur génération')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 animate-in slide-in-from-top duration-500">
        <h1 className="text-3xl font-bold mb-2">
          Bonjour {user?.email?.split('@')[0]} 👋
        </h1>
        <p className="text-zinc-400 mb-2">
          5 crédits restants ce mois
        </p>
        <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="w-1/2 h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Main input */}
      <Card className="p-8 mb-8 bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          🎥 Analyser une nouvelle vidéo
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="bg-zinc-800 border-zinc-700 focus:border-purple-500 transition-colors duration-300"
          />
          <Button
            onClick={handleAnalyze}
            disabled={loading || !url}
            className="bg-purple-600 hover:bg-purple-700 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Analyse...
              </div>
            ) : (
              'Analyser →'
            )}
          </Button>
        </div>
        <p className="text-sm text-zinc-500 mt-2 flex items-center gap-1">
          💡 Fonctionne sur les vidéos jusqu'à 1h
        </p>
      </Card>

      {/* Error */}
      {error && (
        <Card className="p-4 mb-8 border-red-500 bg-red-950/20 animate-in slide-in-from-top duration-300">
          <p className="text-red-400 flex items-center gap-2">
            ⚠️ {error}
          </p>
        </Card>
      )}

      {/* Metadata preview */}
      {metadata && (
        <Card className="p-6 mb-8 bg-zinc-900/50 border-zinc-800 animate-in slide-in-from-bottom duration-500">
          <div className="flex gap-4 mb-4">
            <img
              src={metadata.thumbnail}
              alt={metadata.title}
              className="w-32 h-20 object-cover rounded transition-transform duration-300 hover:scale-105"
            />
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">{metadata.title}</h3>
              <p className="text-sm text-zinc-400 mb-1">{metadata.channel}</p>
              <p className="text-sm text-zinc-400 flex items-center gap-2">
                ⏱️ {metadata.duration_minutes} min • 1 crédit
              </p>
            </div>
          </div>

          <div className="p-4 bg-green-950/20 border border-green-700 rounded transition-all duration-300 hover:bg-green-950/30">
            <p className="font-medium text-green-400 mb-1 flex items-center gap-2">
              ✅ Vidéo prête
            </p>
            <p className="text-sm text-zinc-400 mb-4">
              ⚡ Traitement estimé : ~1min30
            </p>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/25"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Génération...
                </div>
              ) : (
                'Générer les contenus →'
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Recent videos */}
      <div className="animate-in slide-in-from-bottom duration-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          📝 Vidéos récentes
        </h2>
        <Card className="p-8 text-center bg-zinc-900/30 border-zinc-800 border-dashed">
          <div className="text-4xl mb-2 opacity-50">🎬</div>
          <p className="text-zinc-500 mb-2">Aucune vidéo pour le moment</p>
          <p className="text-sm text-zinc-600">
            Vos vidéos traitées apparaîtront ici
          </p>
        </Card>
      </div>
    </div>
  )
}