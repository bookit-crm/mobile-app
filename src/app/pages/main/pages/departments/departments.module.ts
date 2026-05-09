import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { DepartmentsPage } from './departments.page';
import { DepartmentPage } from './pages/department/department.page';

const routes: Routes = [
  { path: '', component: DepartmentsPage },
  { path: ':id', component: DepartmentPage },
];

@NgModule({
  declarations: [DepartmentsPage, DepartmentPage],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    TranslateModule,
  ],
})
export class DepartmentsPageModule {}
