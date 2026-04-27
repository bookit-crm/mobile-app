import { Signal } from '@angular/core';
import { EFeatureLevel, TFeatureKey } from '@core/models/subscription.interface';

export interface ISideMenuItem {
  title: string;
  url: string;
  icon: string;
  useSeparator?: boolean;
  badgeSignal?: Signal<number>;
  /** Ключ фичи подписки — если задан, пункт скрывается без нужного уровня */
  feature?: TFeatureKey;
  /** Минимальный уровень фичи (только для EFeatureLevel-фич) */
  minLevel?: EFeatureLevel;
}
