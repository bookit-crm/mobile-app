/**
 * SaaS Subscription Tiers — типы и интерфейсы.
 * Зеркало бэка: core-api/src/features/subscription/constants/feature-flags.const.ts
 */

/**
 * Scope нотификаций по тарифу:
 * - 'appointments-only' — только NewBookings/Cancellations (Individual)
 * - 'full' — все категории (Starter / Professional / Enterprise)
 */
export type TNotificationsScope = 'appointments-only' | 'full';

/**
 * Категории нотификаций, разрешённые для тарифа `appointments-only`.
 */
export const APPOINTMENT_NOTIFICATION_CATEGORIES: readonly string[] = [
  'new_bookings',
  'cancellations',
];

export enum ETier {
  INDIVIDUAL   = 'individual',
  STARTER      = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE   = 'enterprise',
}

export enum EFeatureLevel {
  NONE     = 'none',
  MINIMAL  = 'minimal',
  BASIC    = 'basic',
  FULL     = 'full',
  ADVANCED = 'advanced',
  BI       = 'bi',
}

export interface IFeatureFlags {
  warehouse:                  EFeatureLevel;
  analytics:                  EFeatureLevel;
  desktopApp:                 EFeatureLevel;
  marketing:                  EFeatureLevel;
  apiAccess:                  EFeatureLevel;
  telegramBot:                boolean;
  promoCodes:                 boolean;
  expensesPayroll:            EFeatureLevel;
  notifications:              EFeatureLevel;
  notificationsScope:         'appointments-only' | 'full';
  prioritySupport:            boolean;
  sso:                        boolean;
  auditLogs:                  boolean;
  storageMb:                  number;
  productsImport:             boolean;
  productsHistory:            boolean;
  productsAttachToService:    boolean;
  productsAttachToAppointment: boolean;
  productsStockAlerts:        boolean;
}

export type TFeatureKey = keyof IFeatureFlags;

export type TSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid';

export interface IStorageUsage {
  usedBytes:   number;
  limitBytes:  number;
  usedMb:      number;
  limitMb:     number;
  percent:     number;
  unlimited:   boolean;
}

export interface ISubscription {
  _id:                   string;
  companyId:             string;
  tier:                  ETier;
  employeeLimit:         number;
  locationLimit:         number;
  features:              IFeatureFlags;
  stripeCustomerId:      string | null;
  stripeSubscriptionId:  string | null;
  stripePriceId:         string | null;
  status:                TSubscriptionStatus;
  currentPeriodStart:    string | null;
  currentPeriodEnd:      string | null;
  cancelAtPeriodEnd:     boolean;
  trialEnd:              string | null;
  storage:               IStorageUsage | null;
}

