'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function ResultsPage() {
  const { id } = useParams()
  const [video, setVideo] = useState<any>(null)
  const [content, setContent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadResults()
  }, [id])

  const loadResults = async () => {
    try {
      // Get video
      const { data: videoData } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single()

      // Get generated content
      const { data: contentData } = await supabase
        .from('generated_content')
        .select('*')
        .eq('video_id', id)

      setVideo(videoData)
      setContent(contentData || [])
    } catch (error) {
      console.error('Error loading results:', error)
      toast.error('Erreur lors du chargement des résultats')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copié dans le presse-papiers!')
    } catch (error) {
      toast.error('Erreur lors de la copie')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-1/2"></div>
          <div className="h-4 bg-zinc-800 rounded w-1/3"></div>
          <div className="h-48 bg-zinc-800 rounded"></div>
        </div>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h1 className="text-2xl font-bold mb-2">Vidéo non trouvée</h1>
        <p className="text-zinc-400">Cette vidéo n'existe pas ou n'est plus disponible.</p>
      </div>
    )
  }

  const formatsByType = content.reduce((acc, item) => {
    acc[item.format_type] = item
    return acc
  }, {} as Record<string, any>)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Video Header */}
      <div className="mb-8 animate-in slide-in-from-top duration-500">
        <h1 className="text-2xl font-bold mb-2">{video?.title}</h1>
        <p className="text-zinc-400 flex items-center gap-2">
          🎬 {video?.channel} • ⏱️ {video?.duration_minutes} min
        </p>
      </div>

      {/* Results Tabs */}
      <Tabs defaultValue="hooks" className="w-full">
        <TabsList className="mb-6 bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="hooks" className="data-[state=active]:bg-purple-600">🎣 Hooks</TabsTrigger>
          <TabsTrigger value="tweets" className="data-[state=active]:bg-purple-600">🐦 Tweets</TabsTrigger>
          <TabsTrigger value="resume" className="data-[state=active]:bg-purple-600">📄 Résumé</TabsTrigger>
          <TabsTrigger value="thread" className="data-[state=active]:bg-purple-600">🧵 Thread</TabsTrigger>
          <TabsTrigger value="linkedin" className="data-[state=active]:bg-purple-600">💼 LinkedIn</TabsTrigger>
          <TabsTrigger value="more" className="data-[state=active]:bg-purple-600">+5 Plus</TabsTrigger>
        </TabsList>

        <TabsContent value="hooks" className="animate-in slide-in-from-right duration-300">
          <FormatCard
            title="🎣 HOOKS (10 variantes)"
            subtitle="Accroches percutantes pour vos vidéos"
            content={formatsByType['HOOK_GENERATOR']?.content}
            onCopy={copyToClipboard}
          />
        </TabsContent>

        <TabsContent value="tweets" className="animate-in slide-in-from-right duration-300">
          <FormatCard
            title="🐦 TWEETS (9 variantes)"
            subtitle="Tweets prêts à publier"
            content={formatsByType['TWEETS']?.content}
            onCopy={copyToClipboard}
          />
        </TabsContent>

        <TabsContent value="resume" className="animate-in slide-in-from-right duration-300">
          <FormatCard
            title="📄 RÉSUMÉ COURT (150 mots)"
            subtitle="Synthèse claire et concise"
            content={formatsByType['RESUME']?.content}
            onCopy={copyToClipboard}
          />
        </TabsContent>

        <TabsContent value="thread" className="animate-in slide-in-from-right duration-300">
          <LockedFormat plan="Starter" format="Thread Twitter" />
        </TabsContent>

        <TabsContent value="linkedin" className="animate-in slide-in-from-right duration-300">
          <LockedFormat plan="Starter" format="Post LinkedIn" />
        </TabsContent>

        <TabsContent value="more" className="animate-in slide-in-from-right duration-300">
          <div className="grid md:grid-cols-2 gap-4">
            <LockedFormat plan="Pro" format="TikTok Scripts" />
            <LockedFormat plan="Pro" format="Newsletter" />
            <LockedFormat plan="Pro" format="Instagram Captions" />
            <LockedFormat plan="Pro" format="YouTube Shorts" />
            <LockedFormat plan="Pro" format="Blog Article" />
            <LockedFormat plan="Pro" format="Email Sequence" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FormatCard({ title, subtitle, content, onCopy }: any) {
  if (!content) {
    return (
      <Card className="p-8 text-center bg-zinc-900/50 border-zinc-800">
        <div className="text-4xl mb-4 opacity-50">⚠️</div>
        <h2 className="text-xl font-bold mb-2">Contenu non disponible</h2>
        <p className="text-zinc-400">Ce format n'a pas encore été généré pour cette vidéo.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">{title}</h2>
        <p className="text-sm text-zinc-400">{subtitle}</p>
      </div>

      <Card className="p-6 bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300">
        <div className="max-h-96 overflow-y-auto mb-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {content.text}
          </pre>
        </div>

        <div className="flex gap-2 pt-4 border-t border-zinc-800">
          <Button
            onClick={() => onCopy(content.text)}
            className="bg-purple-600 hover:bg-purple-700 transition-all duration-300 hover:scale-105"
          >
            📋 Copier
          </Button>
          <Button
            variant="outline"
            className="border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 transition-all duration-300"
          >
            🔄 Régénérer
          </Button>
          <Button
            variant="outline"
            className="border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 transition-all duration-300"
          >
            ✏️ Modifier
          </Button>
        </div>
      </Card>
    </div>
  )
}

function LockedFormat({ plan, format }: { plan: string; format: string }) {
  return (
    <Card className="p-8 text-center bg-zinc-900/30 border-zinc-800 border-dashed hover:border-zinc-700 transition-all duration-300">
      <div className="relative">
        {/* Blurred preview content */}
        <div className="blur-sm mb-6 select-none opacity-50">
          <div className="space-y-2 text-left">
            <p className="font-medium">Aperçu du contenu {format}...</p>
            <p className="text-sm text-zinc-400">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
            <p className="text-sm text-zinc-400">
              Ut enim ad minim veniam, quis nostrud exercitation...
            </p>
          </div>
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-zinc-700">
            <div className="text-3xl mb-2">🔒</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="font-bold text-lg mb-1">Débloquer {format}</p>
          <p className="text-zinc-400">
            ⚡ Inclus dans le plan {plan}
          </p>
        </div>

        <div className="flex gap-2 justify-center">
          <Button className="bg-purple-600 hover:bg-purple-700 transition-all duration-300 hover:scale-105">
            Voir les plans →
          </Button>
          <Button variant="outline" className="border-zinc-700 hover:border-zinc-600">
            Essai gratuit
          </Button>
        </div>
      </div>
    </Card>
  )
}