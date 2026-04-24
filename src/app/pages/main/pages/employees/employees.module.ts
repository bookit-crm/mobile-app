import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { EmployeesPage } from './employees.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: EmployeesPage }];
@NgModule({
  declarations: [EmployeesPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class EmployeesPageModule {}
