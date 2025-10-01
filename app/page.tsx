import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-xl font-bold">ContentForge</div>
          <div className="flex gap-4">
            <Link href="/pricing">
              <Button variant="ghost">Pricing</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline">Se connecter</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Transformez vos vidéos YouTube
          <br />
          en contenu viral
        </h1>
        <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
          Tweets, LinkedIn, TikTok, newsletters... Générez 10+ formats
          en 30 secondes avec l'IA.
        </p>
        <Link href="/signup">
          <Button size="lg" className="bg-purple-600 hover:bg-purple-700 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25">
            Essayer gratuitement →
          </Button>
        </Link>
        <p className="text-sm text-zinc-500 mt-4">
          Aucune carte bancaire requise • 5 vidéos gratuites
        </p>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Comment ça marche
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center group hover:scale-105 transition-transform duration-300">
            <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-300">🎥</div>
            <h3 className="font-bold mb-2">1. Collez l'URL</h3>
            <p className="text-zinc-400">
              N'importe quelle vidéo YouTube jusqu'à 1h
            </p>
          </div>
          <div className="text-center group hover:scale-105 transition-transform duration-300">
            <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-300">⚡</div>
            <h3 className="font-bold mb-2">2. IA analyse</h3>
            <p className="text-zinc-400">
              30 secondes pour générer tous les formats
            </p>
          </div>
          <div className="text-center group hover:scale-105 transition-transform duration-300">
            <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-300">🚀</div>
            <h3 className="font-bold mb-2">3. Publiez</h3>
            <p className="text-zinc-400">
              Copiez-collez sur toutes les plateformes
            </p>
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Pricing simple
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <PricingCard
            name="Gratuit"
            price="0€"
            features={[
              '5 vidéos/mois',
              '3 formats de contenu',
              'Vidéos max 30 min',
            ]}
          />
          <PricingCard
            name="Starter"
            price="9€"
            popular
            features={[
              '30 vidéos/mois',
              '8 formats de contenu',
              'Vidéos max 1h',
              'Historique illimité',
            ]}
          />
          <PricingCard
            name="Pro"
            price="29€"
            features={[
              '150 vidéos/mois',
              '13 formats (tous)',
              'Vidéos max 1h20',
              'API access',
            ]}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="container mx-auto px-4 text-center text-zinc-500">
          <p>© 2025 ContentForge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function PricingCard({
  name,
  price,
  features,
  popular = false
}: {
  name: string
  price: string
  features: string[]
  popular?: boolean
}) {
  return (
    <div className={`border rounded-lg p-6 transition-all duration-300 hover:scale-105 ${
      popular
        ? 'border-purple-500 relative bg-purple-950/20 hover:shadow-xl hover:shadow-purple-500/20'
        : 'border-zinc-800 hover:border-zinc-700 hover:shadow-xl hover:shadow-zinc-500/10'
    }`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-xs px-3 py-1 rounded-full animate-pulse">
          POPULAIRE
        </div>
      )}
      <h3 className="text-xl font-bold mb-2">{name}</h3>
      <div className="text-3xl font-bold mb-4">{price}<span className="text-lg text-zinc-400">/mois</span></div>
      <ul className="space-y-2 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="text-sm text-zinc-400 flex items-center">
            <span className="text-green-400 mr-2">✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <Button
        className={`w-full transition-all duration-300 ${
          popular
            ? "bg-purple-600 hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/25"
            : "hover:bg-zinc-800"
        }`}
        variant={popular ? "default" : "outline"}
      >
        Commencer
      </Button>
    </div>
  )
}