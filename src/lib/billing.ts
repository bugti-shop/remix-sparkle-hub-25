// Billing Configuration - Product and entitlement identifiers for RevenueCat

import { Capacitor } from '@capacitor/core';

// Entitlement identifier - matches RevenueCat dashboard
export const ENTITLEMENT_ID = 'npd Pro';

// Product identifiers - matches RevenueCat dashboard and store products
export const BILLING_CONFIG = {
  weekly: {
    productId: 'nnppd_weekly:nnnpd-weekly',
    basePlanId: 'nnnpd-weekly',
  },
  monthly: {
    productId: 'npd_mo:npd-mo',
    basePlanId: 'npd-mo',
    trialOfferId: 'npd-monthly-offer',
  },
  yearly: {
    productId: 'npd_yr:npd-yearly-plan',
    basePlanId: 'npd-yearly-plan',
    trialOfferId: 'npd-yearly-trial',
  },
} as const;

export type PlanType = keyof typeof BILLING_CONFIG;

export interface SubscriptionProduct {
  productId: string;
  basePlanId?: string;
  purchaseOptionId?: string;
}

export const getSubscriptionDetails = (plan: PlanType): SubscriptionProduct => {
  return BILLING_CONFIG[plan];
};

// Pricing display (for UI only - actual pricing comes from RevenueCat/Store)
export const PRICING_DISPLAY = {
  weekly: {
    price: '$2.63',
    period: 'week',
    displayPrice: '$2.63/wk',
  },
  monthly: {
    price: '$7.49',
    period: 'month',
    displayPrice: '$7.49/mo',
  },
  yearly: {
    price: '$49.99',
    period: 'year',
    displayPrice: '$49.99/yr',
  },
} as const;

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};
