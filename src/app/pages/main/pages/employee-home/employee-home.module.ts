import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeHomePage } from './employee-home.page';
import { AppointmentViewModalComponent } from '@core/components/appointment-view-modal/appointment-view-modal.component';

const routes: Routes = [{ path: '', component: EmployeeHomePage }];

@NgModule({
  declarations: [EmployeeHomePage],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
    TranslateModule,
    AppointmentViewModalComponent,
  ],
})
export class EmployeeHomePageModule {}
