import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PRICE_IDS } from '@/lib/stripe/client'
import { rateLimiters, checkUserViolations } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting for payment attempts
    const rateLimitResult = await rateLimiters.checkout(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // SECURITY: Check user security status before processing payment
    const userViolations = await checkUserViolations(user.id);
    if (userViolations.isSuspended) {
      return NextResponse.json(
        { error: 'Compte suspendu. Impossible de procéder au paiement.' },
        { status: 403 }
      );
    }

    if (userViolations.riskLevel === 'critical') {
      return NextResponse.json(
        { error: 'Compte restreint. Veuillez contacter le support.' },
        { status: 403 }
      );
    }

    const { plan } = await request.json()
    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS]

    if (!priceId) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
    }

    // Mock mode when Stripe keys are missing (for development)
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('⚠️  Mock mode: Stripe keys not configured')
      return NextResponse.json({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?mock_payment=success&plan=${plan}`
      })
    }

    // Get or create Stripe customer
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = userData?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      const { error: updateError } = await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating user with customer ID:', updateError)
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        user_id: user.id,
        plan,
      },
      // Enable automatic tax calculation
      automatic_tax: { enabled: true },
      // Add customer portal for subscription management
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du checkout' },
      { status: 500 }
    )
  }
}