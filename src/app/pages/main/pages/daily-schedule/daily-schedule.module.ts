import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { DailySchedulePage } from './daily-schedule.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: DailySchedulePage }];
@NgModule({
  declarations: [DailySchedulePage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class DailySchedulePageModule {}
