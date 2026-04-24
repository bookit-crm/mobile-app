import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { DepartmentsPage } from './departments.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: DepartmentsPage }];
@NgModule({
  declarations: [DepartmentsPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class DepartmentsPageModule {}
