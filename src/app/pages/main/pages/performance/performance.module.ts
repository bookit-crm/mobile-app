import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PerformancePage } from './performance.page';

const routes: Routes = [{ path: '', component: PerformancePage }];

@NgModule({
  declarations: [PerformancePage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes), TranslateModule],
})
export class PerformancePageModule {}
