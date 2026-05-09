import { NgModule } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { EmployeesPage } from './employees.page';
import { EmployeeFormModalComponent } from './components/employee-form-modal/employee-form-modal.component';
import { ManagerFormModalComponent } from './components/manager-form-modal/manager-form-modal.component';

const routes: Routes = [{ path: '', component: EmployeesPage }];

@NgModule({
  declarations: [EmployeesPage],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    CurrencyPipe,
    RouterModule.forChild(routes),
    TranslateModule,
    // Standalone modal components
    EmployeeFormModalComponent,
    ManagerFormModalComponent,
  ],
})
export class EmployeesPageModule {}
