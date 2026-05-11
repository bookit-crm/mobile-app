import { EFeatureLevel } from '@core/models/subscription.interface';
import { ISideMenuItem } from '../models/side-menu-item.interface';

export const ADMIN_MENU_CONFIG: ISideMenuItem[] = [
  { title: 'MENU_DEPARTMENTS',    url: '/main/departments',    icon: 'business-outline' },
  { title: 'MENU_DASHBOARD',      url: '/main/dashboard',      icon: 'pie-chart-outline' },
  { title: 'MENU_CALENDAR',       url: '/main/calendar',       icon: 'calendar-outline' },
  { title: 'MENU_APPOINTMENTS',   url: '/main/appointments',   icon: 'clipboard-outline' },
  { title: 'MENU_DAILY_SCHEDULE', url: '/main/daily-schedule', icon: 'time-outline' },
  { title: 'MENU_EMPLOYEES',      url: '/main/employees',      icon: 'people-outline' },
  { title: 'MENU_SERVICES',       url: '/main/services',       icon: 'layers-outline' },
  { title: 'MENU_CLIENTS',        url: '/main/clients',        icon: 'person-outline' },
  { title: 'MENU_WAREHOUSE',      url: '/main/products',       icon: 'cube-outline',       feature: 'warehouse',       minLevel: EFeatureLevel.BASIC },
  { title: 'MENU_EXPENSES',       url: '/main/expenses',       icon: 'card-outline',       feature: 'expensesPayroll', minLevel: EFeatureLevel.BASIC },
  { title: 'MENU_PAYROLL',        url: '/main/payroll',        icon: 'briefcase-outline',  feature: 'expensesPayroll', minLevel: EFeatureLevel.BASIC },
  { title: 'MENU_PROMO_CODES',    url: '/main/promo-codes',    icon: 'pricetag-outline',   feature: 'promoCodes' },
  { title: 'MENU_NOTIFICATION',   url: '/main/notification',   icon: 'notifications-outline', useSeparator: true },
  { title: 'MENU_FAQ',            url: '/main/faq',            icon: 'help-circle-outline' },
  { title: 'MENU_SUPPORT',        url: '/main/support',        icon: 'headset-outline' },
];

export const MANAGER_MENU_CONFIG: ISideMenuItem[] = [
  { title: 'MENU_DASHBOARD',      url: '/main/dashboard',      icon: 'pie-chart-outline' },
  { title: 'MENU_CALENDAR',       url: '/main/calendar',       icon: 'calendar-outline' },
  { title: 'MENU_APPOINTMENTS',   url: '/main/appointments',   icon: 'clipboard-outline' },
  { title: 'MENU_DAILY_SCHEDULE', url: '/main/daily-schedule', icon: 'time-outline' },
  { title: 'MENU_EMPLOYEES',      url: '/main/employees',      icon: 'people-outline' },
  { title: 'MENU_SERVICES',       url: '/main/services',       icon: 'layers-outline' },
  { title: 'MENU_CLIENTS',        url: '/main/clients',        icon: 'person-outline' },
  { title: 'MENU_WAREHOUSE',      url: '/main/products',       icon: 'cube-outline',       feature: 'warehouse',       minLevel: EFeatureLevel.BASIC },
  { title: 'MENU_EXPENSES',       url: '/main/expenses',       icon: 'card-outline',       feature: 'expensesPayroll', minLevel: EFeatureLevel.BASIC },
  { title: 'MENU_PAYROLL',        url: '/main/payroll',        icon: 'briefcase-outline',  feature: 'expensesPayroll', minLevel: EFeatureLevel.BASIC },
  { title: 'MENU_PROMO_CODES',    url: '/main/promo-codes',    icon: 'pricetag-outline',   feature: 'promoCodes' },
  { title: 'MENU_NOTIFICATION',   url: '/main/notification',   icon: 'notifications-outline', useSeparator: true },
  { title: 'MENU_FAQ',            url: '/main/faq',            icon: 'help-circle-outline' },
  { title: 'MENU_SUPPORT',        url: '/main/support',        icon: 'headset-outline' },
];
