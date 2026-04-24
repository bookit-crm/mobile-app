import { ISideMenuItem } from '../models/side-menu-item.interface';

export const ADMIN_MENU_CONFIG: ISideMenuItem[] = [
  { title: 'DEPARTMENTS', url: '/main/departments', icon: 'business-outline' },
  { title: 'DASHBOARD', url: '/main/dashboard', icon: 'pie-chart-outline' },
  { title: 'CALENDAR', url: '/main/calendar', icon: 'calendar-outline' },
  { title: 'APPOINTMENTS', url: '/main/appointments', icon: 'clipboard-outline' },
  { title: 'DAILY_SCHEDULE', url: '/main/daily-schedule', icon: 'time-outline' },
  { title: 'EMPLOYEES', url: '/main/employees', icon: 'people-outline' },
  { title: 'SERVICES', url: '/main/services', icon: 'layers-outline' },
  { title: 'CLIENTS', url: '/main/clients', icon: 'person-outline' },
  { title: 'PRODUCTS', url: '/main/products', icon: 'cube-outline' },
  { title: 'EXPENSES', url: '/main/expenses', icon: 'card-outline' },
  { title: 'PAYROLL', url: '/main/payroll', icon: 'briefcase-outline' },
  { title: 'PROMO_CODES', url: '/main/promo-codes', icon: 'pricetag-outline' },
  { title: 'NOTIFICATION', url: '/main/notification', icon: 'notifications-outline', useSeparator: true },
  { title: 'FAQ', url: '/main/faq', icon: 'help-circle-outline' },
];

export const MANAGER_MENU_CONFIG: ISideMenuItem[] = [
  { title: 'DASHBOARD', url: '/main/dashboard', icon: 'pie-chart-outline' },
  { title: 'CALENDAR', url: '/main/calendar', icon: 'calendar-outline' },
  { title: 'APPOINTMENTS', url: '/main/appointments', icon: 'clipboard-outline' },
  { title: 'DAILY_SCHEDULE', url: '/main/daily-schedule', icon: 'time-outline' },
  { title: 'EMPLOYEES', url: '/main/employees', icon: 'people-outline' },
  { title: 'SERVICES', url: '/main/services', icon: 'layers-outline' },
  { title: 'CLIENTS', url: '/main/clients', icon: 'person-outline' },
  { title: 'PRODUCTS', url: '/main/products', icon: 'cube-outline' },
  { title: 'EXPENSES', url: '/main/expenses', icon: 'card-outline' },
  { title: 'PAYROLL', url: '/main/payroll', icon: 'briefcase-outline' },
  { title: 'PROMO_CODES', url: '/main/promo-codes', icon: 'pricetag-outline' },
  { title: 'NOTIFICATION', url: '/main/notification', icon: 'notifications-outline', useSeparator: true },
  { title: 'FAQ', url: '/main/faq', icon: 'help-circle-outline' },
];

