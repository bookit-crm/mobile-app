import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { PayrollPage } from './payroll.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: PayrollPage }];
@NgModule({
  declarations: [PayrollPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class PayrollPageModule {}
