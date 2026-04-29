import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainPage } from './main.page';

const routes: Routes = [
  {
    path: '',
    component: MainPage,
    children: [
      { path: '', redirectTo: 'appointments', pathMatch: 'full' },
      {
        path: 'appointments',
        loadChildren: () =>
          import('./pages/appointments/appointments.module').then(m => m.AppointmentsPageModule),
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./pages/dashboard/dashboard.module').then(m => m.DashboardPageModule),
      },
      {
        path: 'calendar',
        loadChildren: () =>
          import('./pages/calendar/calendar.module').then(m => m.CalendarPageModule),
      },
      {
        path: 'daily-schedule',
        loadChildren: () =>
          import('./pages/daily-schedule/daily-schedule.module').then(m => m.DailySchedulePageModule),
      },
      {
        path: 'employees',
        loadChildren: () =>
          import('./pages/employees/employees.module').then(m => m.EmployeesPageModule),
      },
      {
        path: 'services',
        loadChildren: () =>
          import('./pages/services/services.module').then(m => m.ServicesPageModule),
      },
      {
        path: 'clients',
        loadChildren: () =>
          import('./pages/clients/clients.module').then(m => m.ClientsPageModule),
      },
      {
        path: 'products',
        loadChildren: () =>
          import('./pages/products/products.module').then(m => m.ProductsPageModule),
      },
      {
        path: 'expenses',
        loadChildren: () =>
          import('./pages/expenses/expenses.module').then(m => m.ExpensesPageModule),
      },
      {
        path: 'payroll',
        loadChildren: () =>
          import('./pages/payroll/payroll.module').then(m => m.PayrollPageModule),
      },
      {
        path: 'promo-codes',
        loadChildren: () =>
          import('./pages/promo-codes/promo-codes.module').then(m => m.PromoCodesPageModule),
      },
      {
        path: 'notification',
        loadChildren: () =>
          import('./pages/notification/notification.module').then(m => m.NotificationPageModule),
      },
      {
        path: 'faq',
        loadChildren: () =>
          import('./pages/faq/faq.module').then(m => m.FaqPageModule),
      },
      {
        path: 'support',
        loadChildren: () =>
          import('./pages/support/support.module').then(m => m.SupportPageModule),
      },
      {
        path: 'departments',
        loadChildren: () =>
          import('./pages/departments/departments.module').then(m => m.DepartmentsPageModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MainPageRoutingModule {}

