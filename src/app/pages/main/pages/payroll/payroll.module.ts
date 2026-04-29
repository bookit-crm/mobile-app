import { NgModule } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { PayrollPage } from './payroll.page';
import { CreatePeriodsModalComponent } from './components/create-periods-modal/create-periods-modal.component';
import { PayrollDetailComponent } from './components/payroll-detail/payroll-detail.component';

const routes: Routes = [{ path: '', component: PayrollPage }];

@NgModule({
  declarations: [PayrollPage],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    FormsModule,
    CurrencyPipe,
    DatePipe,
    TitleCasePipe,
    RouterModule.forChild(routes),
    // Standalone modal components
    CreatePeriodsModalComponent,
    PayrollDetailComponent,
  ],
})
export class PayrollPageModule {}
