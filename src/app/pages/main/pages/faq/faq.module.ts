import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FaqPage } from './faq.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: FaqPage }];
@NgModule({
  declarations: [FaqPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class FaqPageModule {}
