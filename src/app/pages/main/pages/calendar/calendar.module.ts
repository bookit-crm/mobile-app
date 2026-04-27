import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { CalendarPage } from './calendar.page';
import { RouterModule, Routes } from '@angular/router';
import { DayViewComponent } from './components/day-view/day-view.component';
import { WeekViewComponent } from './components/week-view/week-view.component';
import { MonthViewComponent } from './components/month-view/month-view.component';
import { CalendarFiltersModalComponent } from './components/calendar-filters-modal/calendar-filters-modal.component';
import { AppointmentModalComponent } from './components/appointment-modal/appointment-modal.component';

const routes: Routes = [{ path: '', component: CalendarPage }];

@NgModule({
  declarations: [CalendarPage],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
    DayViewComponent,
    WeekViewComponent,
    MonthViewComponent,
    CalendarFiltersModalComponent,
    AppointmentModalComponent,
  ],
})
export class CalendarPageModule {}
