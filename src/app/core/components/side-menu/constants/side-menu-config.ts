import { EFeatureLevel } from '@core/models/subscription.interface';
import { ISideMenuItem } from '../models/side-menu-item.interface';

export const ADMIN_MENU_CONFIG: ISideMenuItem[] = [
  { title: 'Departments',    url: '/main/departments',   icon: 'business-outline' },
  { title: 'Dashboard',      url: '/main/dashboard',     icon: 'pie-chart-outline' },
  { title: 'Calendar',       url: '/main/calendar',      icon: 'calendar-outline' },
  { title: 'Appointments',   url: '/main/appointments',  icon: 'clipboard-outline' },
  { title: 'Daily Schedule', url: '/main/daily-schedule',icon: 'time-outline' },
  { title: 'Employees',      url: '/main/employees',     icon: 'people-outline' },
  { title: 'Services',       url: '/main/services',      icon: 'layers-outline' },
  { title: 'Clients',        url: '/main/clients',       icon: 'person-outline' },
  { title: 'Warehouse',      url: '/main/products',      icon: 'cube-outline',       feature: 'warehouse',       minLevel: EFeatureLevel.BASIC },
  { title: 'Expenses',       url: '/main/expenses',      icon: 'card-outline',       feature: 'expensesPayroll', minLevel: EFeatureLevel.BASIC },
  { title: 'Payroll',        url: '/main/payroll',       icon: 'briefcase-outline',  feature: 'expensesPayroll', minLevel: EFeatureLevel.BASIC },
  { title: 'Promo Codes',    url: '/main/promo-codes',   icon: 'pricetag-outline',   feature: 'promoCodes' },
  { title: 'Notification',   url: '/main/notification',  icon: 'notifications-outline', useSeparator: true },
  { title: 'FAQ',            url: '/main/faq',           icon: 'help-circle-outline' },
];

export const MANAGER_MENU_CONFIG: ISideMenuItem[] = [
  { title: 'Dashboard',      url: '/main/dashboard',     icon: 'pie-chart-outline' },
  { title: 'Calendar',       url: '/main/calendar',      icon: 'calendar-outline' },
  { title: 'Appointments',   url: '/main/appointments',  icon: 'clipboard-outline' },
  { title: 'Daily Schedule', url: '/main/daily-schedule',icon: 'time-outline' },
  { title: 'Employees',      url: '/main/employees',     icon: 'people-outline' },
  { title: 'Services',       url: '/main/services',      icon: 'layers-outline' },
  { title: 'Clients',        url: '/main/clients',       icon: 'person-outline' },
  { title: 'Warehouse',      url: '/main/products',      icon: 'cube-outline',       feature: 'warehouse',       minLevel: EFeatureLevel.BASIC },
  { title: 'Expenses',       url: '/main/expenses',      icon: 'card-outline',       feature: 'expensesPayroll', minLevel: EFeatureLevel.BASIC },
  { title: 'Payroll',        url: '/main/payroll',       icon: 'briefcase-outline',  feature: 'expensesPayroll', minLevel: EFeatureLevel.BASIC },
  { title: 'Promo Codes',    url: '/main/promo-codes',   icon: 'pricetag-outline',   feature: 'promoCodes' },
  { title: 'Notification',   url: '/main/notification',  icon: 'notifications-outline', useSeparator: true },
  { title: 'FAQ',            url: '/main/faq',           icon: 'help-circle-outline' },
];
