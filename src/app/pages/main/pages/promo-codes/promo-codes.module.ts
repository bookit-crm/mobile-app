import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { PromoCodesPage } from './promo-codes.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: PromoCodesPage }];
@NgModule({
  declarations: [PromoCodesPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class PromoCodesPageModule {}
