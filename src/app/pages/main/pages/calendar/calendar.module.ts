import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { CalendarPage } from './calendar.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: CalendarPage }];
@NgModule({
  declarations: [CalendarPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class CalendarPageModule {}
