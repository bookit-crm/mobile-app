import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { NotificationPage } from './notification.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: NotificationPage }];
@NgModule({
  declarations: [NotificationPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class NotificationPageModule {}
