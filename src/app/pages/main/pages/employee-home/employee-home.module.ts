import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeHomePage } from './employee-home.page';

const routes: Routes = [{ path: '', component: EmployeeHomePage }];

@NgModule({
  declarations: [EmployeeHomePage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes), TranslateModule],
})
export class EmployeeHomePageModule {}
