'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const handleCheckout = async (plan: string) => {
    setLoading(plan)

    try {
      // Check if user is authenticated
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Redirect to login if not authenticated
        router.push('/auth/login?redirect=/pricing')
        return
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      if (!res.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { url, error } = await res.json()

      if (error) {
        throw new Error(error)
      }

      // Redirect to Stripe checkout
      window.location.href = url
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Erreur lors du checkout. Veuillez réessayer.')
    } finally {
      setLoading(null)
    }
  }

  const plans = [
    {
      id: 'free',
      name: 'Gratuit',
      price: '0€',
      period: '/mois',
      description: 'Parfait pour découvrir',
      features: [
        '5 vidéos/mois',
        '3 formats de contenu',
        'Vidéos max 30 min',
        'Export basique',
      ],
      limitations: [
        'Pas d\'historique illimité',
        'Support communautaire uniquement',
        'Watermark sur exports',
      ],
      cta: 'Plan actuel',
      disabled: true,
      popular: false,
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '9€',
      period: '/mois',
      description: 'Pour les créateurs actifs',
      features: [
        '30 vidéos/mois',
        '8 formats de contenu',
        'Vidéos max 1h',
        'Historique illimité',
        'Export HD sans watermark',
        'Support email',
        'Templates personnalisés',
      ],
      limitations: [],
      cta: 'Choisir Starter',
      disabled: false,
      popular: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '29€',
      period: '/mois',
      description: 'Pour les professionnels',
      features: [
        '150 vidéos/mois',
        '13 formats (tous)',
        'Vidéos max 1h20',
        'API access',
        'Intégrations avancées',
        'Support prioritaire',
        'Analytics détaillées',
        'White-label export',
      ],
      limitations: [],
      cta: 'Choisir Pro',
      disabled: false,
      popular: false,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
            Choisissez votre plan
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Transformez vos vidéos YouTube en contenu viral pour tous vos réseaux sociaux
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`p-8 relative transition-all duration-300 hover:scale-105 ${
                plan.popular
                  ? 'border-purple-500 bg-gradient-to-b from-purple-500/10 to-transparent shadow-xl shadow-purple-500/20'
                  : 'border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-transparent hover:border-zinc-700'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-purple-400 text-white text-sm font-semibold px-4 py-2 rounded-full">
                  ⭐ POPULAIRE
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center mb-2">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  <span className="text-lg text-zinc-400 ml-1">{plan.period}</span>
                </div>
                <p className="text-zinc-400">{plan.description}</p>
              </div>

              {/* Features List */}
              <div className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center text-sm">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
                {plan.limitations.map((limitation, index) => (
                  <div key={index} className="flex items-center text-sm text-zinc-500">
                    <X className="w-5 h-5 text-zinc-600 mr-3 flex-shrink-0" />
                    <span>{limitation}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <Button
                className={`w-full py-3 text-base font-semibold transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/25'
                    : plan.disabled
                    ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-zinc-200'
                }`}
                onClick={() => handleCheckout(plan.id)}
                disabled={plan.disabled || loading === plan.id}
              >
                {loading === plan.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Redirection...
                  </>
                ) : (
                  plan.cta
                )}
              </Button>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Questions fréquentes</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Puis-je changer de plan ?</h3>
                <p className="text-zinc-400">
                  Oui, vous pouvez upgrader ou downgrader votre plan à tout moment.
                  Les changements prennent effet immédiatement.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Que se passe-t-il si je dépasse mes crédits ?</h3>
                <p className="text-zinc-400">
                  Vous pouvez upgrader votre plan ou attendre le renouvellement mensuel.
                  Aucun frais supplémentaire n'est appliqué.
                </p>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Y a-t-il un engagement ?</h3>
                <p className="text-zinc-400">
                  Non, tous nos plans sont sans engagement. Vous pouvez annuler
                  votre abonnement à tout moment.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Proposez-vous des remises pour les équipes ?</h3>
                <p className="text-zinc-400">
                  Contactez-nous pour des tarifs préférentiels sur les plans Business
                  pour les équipes de 5+ utilisateurs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Money Back Guarantee */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center px-6 py-3 bg-green-500/10 border border-green-500/20 rounded-full">
            <Check className="w-5 h-5 text-green-500 mr-2" />
            <span className="text-green-400 font-medium">
              Garantie satisfait ou remboursé 30 jours
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}