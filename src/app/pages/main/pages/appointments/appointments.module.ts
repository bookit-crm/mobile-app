import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AppointmentsPage } from './appointments.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: AppointmentsPage }];
@NgModule({
  declarations: [AppointmentsPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class AppointmentsPageModule {}
