import React from 'react';
import Constants from 'expo-constants';

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const MERCHANT_ID = process.env.EXPO_PUBLIC_MERCHANT_ID ?? 'merchant.com.takememobility.rider';

/**
 * Detect Expo Go — native modules (including Stripe) are not available.
 * Constants.appOwnership === 'expo' in Expo Go.
 */
const isExpoGo = Constants.appOwnership === 'expo';

export const isStripeConfigured = PUBLISHABLE_KEY.length > 0 && !isExpoGo;

/**
 * Stripe provider. In Expo Go, renders children without Stripe.
 * In a dev build, wraps with the real StripeProvider.
 *
 * NOTE: Even `require()` inside a condition gets statically analyzed by Metro.
 * So we use a metro config resolver to stub the module in Expo Go instead.
 * For now, we wrap the require in try/catch as a runtime safety net.
 */
export function StripeProvider({ children }: { children: React.ReactNode }) {
  if (!isStripeConfigured) {
    return <>{children}</>;
  }

  try {
    const { StripeProvider: Native } = require('@stripe/stripe-react-native');
    return (
      <Native publishableKey={PUBLISHABLE_KEY} merchantIdentifier={MERCHANT_ID}>
        {children}
      </Native>
    );
  } catch {
    return <>{children}</>;
  }
}
