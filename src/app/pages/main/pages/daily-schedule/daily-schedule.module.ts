import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { DailySchedulePage } from './daily-schedule.page';
import { RouterModule, Routes } from '@angular/router';
import { EmployeeAvatarComponent } from '@core/components/employee-avatar/employee-avatar.component';

const routes: Routes = [{ path: '', component: DailySchedulePage }];

@NgModule({
  declarations: [DailySchedulePage],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    RouterModule.forChild(routes),
    EmployeeAvatarComponent,
  ],
})
export class DailySchedulePageModule {}
