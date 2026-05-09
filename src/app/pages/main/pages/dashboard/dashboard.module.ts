import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule } from '@ngx-translate/core';

import { DashboardPage } from './dashboard.page';
import { RevenueTabComponent } from './components/revenue-tab/revenue-tab.component';
import { ClientsTabComponent } from './components/clients-tab/clients-tab.component';
import { EmployeesTabComponent } from './components/employees-tab/employees-tab.component';
import { ScheduleTabComponent } from './components/schedule-tab/schedule-tab.component';
import { InventoryTabComponent } from './components/inventory-tab/inventory-tab.component';
import { ExpensesTabComponent } from './components/expenses-tab/expenses-tab.component';
import { PromoCodesTabComponent } from './components/promo-codes-tab/promo-codes-tab.component';
import { ReportsTabComponent } from './components/reports-tab/reports-tab.component';

const routes: Routes = [{ path: '', component: DashboardPage }];

@NgModule({
  declarations: [DashboardPage],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
    NgApexchartsModule,
    TranslateModule,
    // Standalone tab components
    RevenueTabComponent,
    ClientsTabComponent,
    EmployeesTabComponent,
    ScheduleTabComponent,
    InventoryTabComponent,
    ExpensesTabComponent,
    PromoCodesTabComponent,
    ReportsTabComponent,
  ],
})
export class DashboardPageModule {}
