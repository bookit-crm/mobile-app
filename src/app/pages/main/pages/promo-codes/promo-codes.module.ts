import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { PromoCodesPage } from './promo-codes.page';
import { PromoCodeFormModalComponent } from './components/promo-code-form-modal/promo-code-form-modal.component';

const routes: Routes = [{ path: '', component: PromoCodesPage }];

@NgModule({
  declarations: [PromoCodesPage],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule.forChild(routes),
    PromoCodeFormModalComponent,
  ],
})
export class PromoCodesPageModule {}
