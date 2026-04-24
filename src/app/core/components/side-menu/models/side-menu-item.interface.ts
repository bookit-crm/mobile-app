import { Signal } from '@angular/core';
export interface ISideMenuItem {
  title: string;
  url: string;
  icon: string;
  useSeparator?: boolean;
  badgeSignal?: Signal<number>;
}
