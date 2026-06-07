export type TAiTier = 'lite' | 'plus' | 'max';

export type TAiSubscriptionStatus =
  | 'none'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid';

export interface IAiTier {
  tier: TAiTier;
  displayName: string;
  monthlyCredits: number;
  dailyCap: number;
  priceUsd: number;
  priceId: string | null;
}

export interface IAiSubscriptionStatus {
  hasSubscription: boolean;
  aiVisible: boolean;
  aiTier: TAiTier | null;
  status: TAiSubscriptionStatus;
  monthly: { used: number; limit: number };
  daily: { used: number; cap: number };
  trial: { total: number; used: number; remaining: number };
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}
