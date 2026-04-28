import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AppointmentsPage } from './appointments.page';
import { RouterModule, Routes } from '@angular/router';
import { AppointmentHistoryPage } from './components/appointment-history/appointment-history.page';
import { AppointmentModalComponent } from '../calendar/components/appointment-modal/appointment-modal.component';

const routes: Routes = [
  { path: '', component: AppointmentsPage },
  { path: ':appointmentId/history', component: AppointmentHistoryPage },
];

@NgModule({
  declarations: [AppointmentsPage, AppointmentHistoryPage],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes),
    AppointmentModalComponent,
  ],
})
export class AppointmentsPageModule {}
