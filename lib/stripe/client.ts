import { loadStripe } from '@stripe/stripe-js';
import Stripe from 'stripe';

// Client-side Stripe loader for frontend
let stripePromise: Promise<any>;

const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

// Server-side Stripe client for backend operations
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

// Price IDs for subscription products
export const PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  pro: process.env.STRIPE_PRO_PRICE_ID!,
};

// Tier configuration for business logic
export const TIER_CREDITS = {
  free: 5,
  starter: 30,    // €9/month
  pro: 150,       // €29/month
  business: 500   // Future tier
};

export const TIER_FORMATS = {
  free: 3,        // Hook, Tweets, Resume
  starter: 8,     // + Thread, LinkedIn, YouTube, Threads, Subject
  pro: 13,        // + Newsletter, TikTok, Thumbnail, Instagram, Followup
  business: 13    // Same as pro for now
};

export default getStripe;