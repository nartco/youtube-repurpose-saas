import { NextResponse } from 'next/server'
import { stripe, TIER_CREDITS } from '@/lib/stripe/client'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 })
  }

  console.log(`🔔 Stripe webhook received: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan

        if (userId && plan) {
          console.log(`✅ Processing checkout completion for user ${userId}, plan: ${plan}`)

          // Update user plan and credits
          const { error: userError } = await supabase
            .from('users')
            .update({
              plan,
              credits_remaining: TIER_CREDITS[plan as keyof typeof TIER_CREDITS] || TIER_CREDITS.free,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

          if (userError) {
            console.error('Error updating user:', userError)
            throw userError
          }

          // Get subscription details if available
          let subscriptionData: any = {
            user_id: userId,
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            status: 'active',
            plan,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          // Try to get subscription details for period dates
          if (session.subscription) {
            try {
              const subscription = await stripe.subscriptions.retrieve(
                session.subscription as string
              ) as any
              if (subscription && subscription.current_period_start) {
                subscriptionData.current_period_start = new Date(subscription.current_period_start * 1000)
                subscriptionData.current_period_end = new Date(subscription.current_period_end * 1000)
              }
            } catch (error) {
              console.warn('Could not retrieve subscription details:', error)
            }
          }

          // Create subscription record
          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .upsert(subscriptionData)

          if (subscriptionError) {
            console.error('Error creating subscription record:', subscriptionError)
            throw subscriptionError
          }

          console.log(`🎉 Successfully upgraded user ${userId} to ${plan}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any
        const customerId = subscription.customer as string

        // Find user by Stripe customer ID
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (userError || !userData) {
          console.error('User not found for customer:', customerId)
          break
        }

        // Update subscription status
        const subscriptionUpdate: any = {
          status: subscription.status,
          updated_at: new Date().toISOString(),
        }

        if (subscription.current_period_start && subscription.current_period_end) {
          subscriptionUpdate.current_period_start = new Date(subscription.current_period_start * 1000)
          subscriptionUpdate.current_period_end = new Date(subscription.current_period_end * 1000)
        }

        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .update(subscriptionUpdate)
          .eq('stripe_subscription_id', subscription.id)

        if (subscriptionError) {
          console.error('Error updating subscription:', subscriptionError)
        }

        console.log(`📅 Updated subscription ${subscription.id} status: ${subscription.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        const customerId = subscription.customer as string

        // Find user by Stripe customer ID
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (userError || !userData) {
          console.error('User not found for customer:', customerId)
          break
        }

        console.log(`❌ Processing subscription cancellation for user ${userData.id}`)

        // Downgrade to free plan
        const { error: downgradeError } = await supabase
          .from('users')
          .update({
            plan: 'free',
            credits_remaining: TIER_CREDITS.free,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userData.id)

        if (downgradeError) {
          console.error('Error downgrading user:', downgradeError)
          throw downgradeError
        }

        // Update subscription status
        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userData.id)

        if (subscriptionError) {
          console.error('Error updating subscription status:', subscriptionError)
        }

        console.log(`⬇️  Successfully downgraded user ${userData.id} to free plan`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const customerId = invoice.customer as string

        // Find user and handle payment failure
        const { data: userData } = await supabase
          .from('users')
          .select('id, email')
          .eq('stripe_customer_id', customerId)
          .single()

        if (userData) {
          console.log(`💸 Payment failed for user ${userData.id}`)
          // Here you could send an email notification or implement retry logic
        }
        break
      }

      default:
        console.log(`🤷‍♂️ Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    )
  }
}