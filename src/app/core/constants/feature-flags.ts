import { EFeatureLevel } from '@core/models/subscription.interface';

/**
 * Порядковая шкала уровней фич — синхронизация с бэком.
 * Чем выше — тем больше прав.
 */
export const FEATURE_LEVEL_ORDER: Record<EFeatureLevel, number> = {
  [EFeatureLevel.NONE]:     0,
  [EFeatureLevel.MINIMAL]:  1,
  [EFeatureLevel.BASIC]:    2,
  [EFeatureLevel.FULL]:     3,
  [EFeatureLevel.ADVANCED]: 4,
  [EFeatureLevel.BI]:       5,
};

