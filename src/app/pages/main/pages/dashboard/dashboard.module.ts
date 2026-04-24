import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { DashboardPage } from './dashboard.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: DashboardPage }];
@NgModule({
  declarations: [DashboardPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class DashboardPageModule {}
