import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { AppointmentsPage } from './appointments.page';
import { RouterModule, Routes } from '@angular/router';
import { AppointmentHistoryPage } from './components/appointment-history/appointment-history.page';
import { AppointmentModalComponent } from '@core/components/appointment-modal/appointment-modal.component';
import { AppointmentViewModalComponent } from '@core/components/appointment-view-modal/appointment-view-modal.component';

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
    TranslateModule,
    RouterModule.forChild(routes),
    AppointmentModalComponent,
    AppointmentViewModalComponent,
  ],
})
export class AppointmentsPageModule {}
